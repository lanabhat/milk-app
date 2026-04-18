from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes as set_permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.db.models import Sum
from datetime import datetime, date
from decimal import Decimal

from .models import (
    Item, Purchase, Advance, SpecialRequest, BillingSession,
    LpgConfig, LpgBooking, LpgUsage, Medicine, StockTransaction, Patient,
    MedicinePurchase, MedicinePurchaseItem, ConsultingRecord,
    HealthExpense, VitalReading,
)
from .serializers import (
    UserSerializer, ItemSerializer, PurchaseSerializer,
    AdvanceSerializer, SpecialRequestSerializer, BillingSessionSerializer,
    LpgConfigSerializer, LpgBookingSerializer, LpgUsageSerializer,
    MedicineSerializer, StockTransactionSerializer, PatientSerializer,
    MedicinePurchaseSerializer, ConsultingRecordSerializer,
    HealthExpenseSerializer, VitalReadingSerializer,
)
from django.db.models import Prefetch


def get_latest_advance(user):
    """Return the most recent advance payment for this user (= current cycle)."""
    return Advance.objects.filter(user=user).order_by('-date', '-created_at').first()


def _parse_date_param(value):
    if not value:
        return None
    return datetime.strptime(value, '%Y-%m-%d').date()


def _build_lpg_history(bookings, today=None):
    today = today or date.today()
    booking_list = list(bookings)
    history = []

    for i, booking in enumerate(booking_list):
        newer_booking = booking_list[i - 1] if i > 0 else None
        days_lasted = (
            (newer_booking.booking_date - booking.booking_date).days
            if newer_booking else None
        )
        history.append({
            **LpgBookingSerializer(booking).data,
            'days_lasted': days_lasted,
            'days_since_booking': (today - booking.booking_date).days,
            'is_current': i == 0,
        })

    return history


def _build_lpg_trends(config, bookings, start=None, end=None):
    filtered = [
        row for row in _build_lpg_history(bookings)
        if (not start or row['booking_date'] >= start.isoformat())
        and (not end or row['booking_date'] <= end.isoformat())
    ]

    completed_rows = [row for row in filtered if row['days_lasted'] is not None]
    priced_rows = [row for row in filtered if row['price'] is not None]
    total_spend = sum(float(row['price']) for row in priced_rows)
    avg_price = (total_spend / len(priced_rows)) if priced_rows else None
    avg_days = (
        sum(row['days_lasted'] for row in completed_rows) / len(completed_rows)
        if completed_rows else None
    )

    date_keys = [row['booking_date'] for row in filtered]
    if start and end and (end - start).days <= 92:
        resolution = 'day'
        point_map = {key: {'bookings': 0, 'spend': 0.0} for key in date_keys}
    else:
        resolution = 'month'
        point_map = {}
        for key in date_keys:
            point_map.setdefault(key[:7], {'bookings': 0, 'spend': 0.0})

    duration_points = []
    price_points = []
    for row in filtered:
        bucket_key = row['booking_date'] if resolution == 'day' else row['booking_date'][:7]
        point_map.setdefault(bucket_key, {'bookings': 0, 'spend': 0.0})
        point_map[bucket_key]['bookings'] += 1
        if row['price'] is not None:
            point_map[bucket_key]['spend'] += float(row['price'])
            price_points.append({'date': row['booking_date'], 'price': float(row['price'])})
        if row['days_lasted'] is not None:
            duration_points.append({'date': row['booking_date'], 'days_lasted': row['days_lasted']})

    booking_points = [
        {'period': key, 'bookings': value['bookings'], 'spend': round(value['spend'], 2)}
        for key, value in sorted(point_map.items())
    ]

    previous_priced = priced_rows[1] if len(priced_rows) > 1 else None
    latest_priced = priced_rows[0] if priced_rows else None

    return {
        'start_date': start.isoformat() if start else None,
        'end_date': end.isoformat() if end else None,
        'resolution': resolution,
        'bookings_count': len(filtered),
        'priced_bookings_count': len(priced_rows),
        'total_spend': round(total_spend, 2),
        'avg_price': round(avg_price, 2) if avg_price is not None else None,
        'avg_days_lasted': round(avg_days, 1) if avg_days is not None else None,
        'current_stock': {
            'total_cylinders': config.total_cylinders,
            'filled_cylinders': config.filled_cylinders,
            'empty_cylinders': config.empty_cylinders,
        },
        'latest_price_change': (
            round(float(latest_priced['price']) - float(previous_priced['price']), 2)
            if latest_priced and previous_priced else None
        ),
        'longest_days_lasted': max((row['days_lasted'] for row in completed_rows), default=None),
        'shortest_days_lasted': min((row['days_lasted'] for row in completed_rows), default=None),
        'booking_points': booking_points,
        'price_points': price_points,
        'duration_points': duration_points,
    }


@api_view(['GET'])
@set_permission_classes([permissions.AllowAny])
def health_check(request):
    return Response({'status': 'ok', 'message': 'Backend is running'})


class ItemViewSet(viewsets.ModelViewSet):
    queryset = Item.objects.all()
    serializer_class = ItemSerializer
    permission_classes = [permissions.IsAuthenticated]


class PurchaseViewSet(viewsets.ModelViewSet):
    serializer_class = PurchaseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Purchase.objects.filter(user=self.request.user)
        advance_id = self.request.query_params.get('advance')
        if advance_id:
            qs = qs.filter(advance_id=advance_id)
        # ?all=true returns everything; default returns all (frontend filters by advance)
        return qs

    def perform_create(self, serializer):
        # Use the advance ID sent by client, or fall back to latest advance
        advance_id = self.request.data.get('advance')
        advance = None
        if advance_id:
            try:
                advance = Advance.objects.get(id=advance_id, user=self.request.user)
            except Advance.DoesNotExist:
                pass
        if advance is None:
            advance = get_latest_advance(self.request.user)
        serializer.save(user=self.request.user, advance=advance)

    @action(detail=False, methods=['get'])
    def daily_total(self, request):
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'error': 'Date parameter required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            d = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'Invalid date format'}, status=status.HTTP_400_BAD_REQUEST)
        total = Purchase.objects.filter(user=request.user, date=d).aggregate(Sum('total'))['total__sum'] or 0
        return Response({'date': d, 'total': total})


class AdvanceViewSet(viewsets.ModelViewSet):
    serializer_class = AdvanceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Advance.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def balance(self, request):
        """
        Returns current cycle balance (latest advance) and all-time totals.
        """
        latest = get_latest_advance(request.user)
        if latest:
            cycle_purchases = Purchase.objects.filter(
                user=request.user, advance=latest
            ).aggregate(Sum('total'))['total__sum'] or 0
            current_balance = latest.amount - cycle_purchases
        else:
            cycle_purchases = 0
            current_balance = 0

        all_advances = Advance.objects.filter(user=request.user).aggregate(
            total_amount=Sum('amount'), total_balance_paid=Sum('balance_paid')
        )
        all_purchases = Purchase.objects.filter(user=request.user).aggregate(Sum('total'))['total__sum'] or 0

        return Response({
            'current_advance_id': latest.id if latest else None,
            'current_advance_amount': latest.amount if latest else 0,
            'current_advance_date': str(latest.date) if latest else None,
            'current_purchases': cycle_purchases,
            'current_balance': current_balance,
            'total_advance': (all_advances['total_amount'] or 0),
            'total_purchases': all_purchases,
            'remaining_balance': (all_advances['total_amount'] or 0) - all_purchases,
        })


class BillingSessionViewSet(viewsets.ModelViewSet):
    """Kept for legacy data; new logic uses Advance as cycle marker."""
    serializer_class = BillingSessionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return BillingSession.objects.filter(user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        session = self.get_object()
        if session.status == 'active':
            return Response({'error': 'Cannot delete the active session'}, status=status.HTTP_400_BAD_REQUEST)
        session.purchases.all().delete()
        session.advances.all().delete()
        session.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def current(self, request):
        from .models import BillingSession
        active = BillingSession.objects.filter(user=request.user, status='active').first()
        if not active:
            return Response({'session': None})
        return Response(BillingSessionSerializer(active).data)


def _get_next_start(usage, user):
    """Return the start_date of the usage that started after this one, or None."""
    later = LpgUsage.objects.filter(user=user, start_date__gt=usage.start_date).order_by('start_date').first()
    return later.start_date if later else None


def _build_usage_record(usage, next_start=None):
    today = date.today()
    end = usage.end_date or next_start
    duration_days = (end - usage.start_date).days if end else (today - usage.start_date).days
    return {
        **LpgUsageSerializer(usage).data,
        'duration_days': duration_days,
        'is_current': usage.end_date is None and next_start is None,
    }


def _build_usage_list(usages, config):
    usage_list_raw = list(usages.order_by('start_date'))
    result = []
    for i, u in enumerate(usage_list_raw):
        next_u = usage_list_raw[i + 1] if i + 1 < len(usage_list_raw) else None
        next_start = next_u.start_date if next_u else None
        result.append(_build_usage_record(u, next_start=next_start))
    result.reverse()  # most recent first for display
    return result


def _build_usage_monthly(usage_list, config):
    """
    For each calendar month touched by any usage period, compute:
      - days of usage in that month
      - prorated liters
      - prorated cost (if price known)
    """
    from calendar import monthrange
    if not usage_list:
        return []

    today = date.today()
    monthly = {}

    for record in usage_list:
        start = date.fromisoformat(record['start_date'])
        # Effective end: use end_date, else today for current cylinder
        if record.get('end_date'):
            end = date.fromisoformat(record['end_date'])
        else:
            end = today

        total_days = (end - start).days or 1
        price = float(record['price']) if record.get('price') is not None else None

        # Walk each month overlapping [start, end)
        cursor = start.replace(day=1)
        while cursor <= end:
            month_key = cursor.strftime('%Y-%m')
            _, last_day = monthrange(cursor.year, cursor.month)
            month_start = cursor
            month_end = date(cursor.year, cursor.month, last_day)

            overlap_start = max(start, month_start)
            overlap_end   = min(end, month_end)
            overlap_days  = max(0, (overlap_end - overlap_start).days + 1)

            if overlap_days > 0:
                fraction = overlap_days / total_days
                entry = monthly.setdefault(month_key, {'month': month_key, 'days': 0, 'liters': 0.0, 'cost': 0.0, 'cost_known': False})
                entry['days'] += overlap_days
                entry['liters'] += round(fraction * config.liters_per_cylinder, 2)
                if price is not None:
                    entry['cost'] += round(fraction * price, 2)
                    entry['cost_known'] = True

            # Advance to next month
            if cursor.month == 12:
                cursor = date(cursor.year + 1, 1, 1)
            else:
                cursor = date(cursor.year, cursor.month + 1, 1)

    return sorted(monthly.values(), key=lambda x: x['month'], reverse=True)


class LpgViewSet(viewsets.ViewSet):
    """
    /api/lpg/status/  GET  — current status + booking history
    /api/lpg/config/  GET/POST — get or update waiting_days
    /api/lpg/book/    POST — add a booking
    /api/lpg/bookings/<id>/ PATCH/DELETE — update or delete a booking
    """
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def status(self, request):
        config, _ = LpgConfig.objects.get_or_create(user=request.user)
        bookings  = LpgBooking.objects.filter(user=request.user)
        latest    = bookings.first()  # ordered by -booking_date

        today          = date.today()
        days_since     = (today - latest.booking_date).days if latest else None
        days_remaining = max(0, config.waiting_days - days_since) if days_since is not None else None
        can_book       = days_since is not None and days_since >= config.waiting_days

        history = _build_lpg_history(bookings, today=today)
        completed_durations = [row['days_lasted'] for row in history if row['days_lasted'] is not None]

        return Response({
            'waiting_days':    config.waiting_days,
            'total_cylinders': config.total_cylinders,
            'filled_cylinders': config.filled_cylinders,
            'empty_cylinders': config.empty_cylinders,
            'can_book':        can_book,
            'days_since':      days_since,
            'days_remaining':  days_remaining,
            'latest_booking':  LpgBookingSerializer(latest).data if latest else None,
            'avg_days_lasted': round(sum(completed_durations) / len(completed_durations), 1) if completed_durations else None,
            'history':         history,
        })

    @action(detail=False, methods=['get', 'post'])
    def config(self, request):
        cfg, _ = LpgConfig.objects.get_or_create(user=request.user)
        if request.method == 'POST':
            s = LpgConfigSerializer(cfg, data=request.data, partial=True)
            s.is_valid(raise_exception=True)
            s.save()
            return Response(LpgConfigSerializer(cfg).data)
        return Response(LpgConfigSerializer(cfg).data)

    @action(detail=False, methods=['post'])
    def book(self, request):
        s = LpgBookingSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save(user=request.user)
        return Response(s.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def trends(self, request):
        config, _ = LpgConfig.objects.get_or_create(user=request.user)
        bookings = LpgBooking.objects.filter(user=request.user)
        try:
            start = _parse_date_param(request.query_params.get('start'))
            end = _parse_date_param(request.query_params.get('end'))
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        if start and end and start > end:
            return Response({'error': 'start cannot be after end'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(_build_lpg_trends(config, bookings, start=start, end=end))

    @action(detail=True, methods=['patch', 'delete'])
    def booking(self, request, pk=None):
        try:
            b = LpgBooking.objects.get(pk=pk, user=request.user)
        except LpgBooking.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            b.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        s = LpgBookingSerializer(b, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    @action(detail=False, methods=['get', 'post'])
    def usage(self, request):
        """
        GET  — list all usage records with computed duration_days and monthly stats
        POST — create a new usage record
        """
        if request.method == 'POST':
            s = LpgUsageSerializer(data=request.data)
            s.is_valid(raise_exception=True)
            # Validate booking belongs to this user if provided
            booking_id = request.data.get('booking')
            if booking_id:
                if not LpgBooking.objects.filter(pk=booking_id, user=request.user).exists():
                    return Response({'error': 'Booking not found'}, status=status.HTTP_400_BAD_REQUEST)
            s.save(user=request.user)
            return Response(_build_usage_record(s.instance), status=status.HTTP_201_CREATED)

        usages = LpgUsage.objects.filter(user=request.user)
        config, _ = LpgConfig.objects.get_or_create(user=request.user)
        usage_list = _build_usage_list(usages, config)
        monthly = _build_usage_monthly(usage_list, config)
        return Response({
            'usages': usage_list,
            'monthly': monthly,
            'liters_per_cylinder': config.liters_per_cylinder,
        })

    @action(detail=True, methods=['patch', 'delete'])
    def usage_detail(self, request, pk=None):
        """PATCH/DELETE a single usage record."""
        try:
            u = LpgUsage.objects.get(pk=pk, user=request.user)
        except LpgUsage.DoesNotExist:
            return Response({'error': 'Not found'}, status=status.HTTP_404_NOT_FOUND)
        if request.method == 'DELETE':
            u.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        # Validate booking belongs to user if being changed
        booking_id = request.data.get('booking')
        if booking_id and not LpgBooking.objects.filter(pk=booking_id, user=request.user).exists():
            return Response({'error': 'Booking not found'}, status=status.HTTP_400_BAD_REQUEST)
        s = LpgUsageSerializer(u, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        config, _ = LpgConfig.objects.get_or_create(user=request.user)
        return Response(_build_usage_record(s.instance, next_start=_get_next_start(s.instance, request.user)))


class SpecialRequestViewSet(viewsets.ModelViewSet):
    serializer_class = SpecialRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SpecialRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class PatientViewSet(viewsets.ModelViewSet):
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Patient.objects.filter(user=self.request.user)
        active_only = self.request.query_params.get('active')
        if active_only == 'true':
            qs = qs.filter(active=True)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['get'])
    def history(self, request, pk=None):
        """Return all stock transactions for medicines belonging to this patient."""
        patient = self.get_object()
        medicine_ids = patient.medicines.values_list('id', flat=True)
        txns = StockTransaction.objects.filter(
            medicine_id__in=medicine_ids
        ).select_related('medicine', 'medicine__patient').order_by('-date')
        limit = int(request.query_params.get('limit', 50))
        txn_type = request.query_params.get('type')
        if txn_type:
            txns = txns.filter(type=txn_type)
        return Response(StockTransactionSerializer(txns[:limit], many=True).data)

    @action(detail=True, methods=['get'])
    def medicines(self, request, pk=None):
        """Return medicines belonging to this patient."""
        patient = self.get_object()
        meds = patient.medicines.all()
        timing = request.query_params.get('timing')
        if timing:
            meds = meds.filter(timing=timing)
        return Response(MedicineSerializer(meds, many=True).data)


class BillViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def cycle_bill(self, request):
        """
        Bill for a specific advance cycle.
        ?advance_id=X  — bill for that advance cycle
        If no advance_id, uses the latest (current) advance.
        Supports ?end_date override and ?advance_override.
        """
        advance_id = request.query_params.get('advance_id')
        end_date_str = request.query_params.get('end_date')
        advance_override = request.query_params.get('advance_override')

        if advance_id:
            try:
                adv = Advance.objects.get(id=advance_id, user=request.user)
            except Advance.DoesNotExist:
                return Response({'error': 'Advance not found'}, status=404)
        else:
            adv = get_latest_advance(request.user)

        if not adv:
            return Response({'error': 'No advance payments found'}, status=404)

        # Date range: from advance date to end_date (or today)
        start = adv.date
        if end_date_str:
            try:
                end = datetime.strptime(end_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'error': 'Invalid end_date'}, status=400)
        else:
            end = date.today()

        # Purchases linked to this advance
        purchases = Purchase.objects.filter(
            user=request.user, advance=adv
        ).order_by('date')

        total_purchases = purchases.aggregate(Sum('total'))['total__sum'] or 0

        if advance_override is not None:
            try:
                advance_amount = float(advance_override)
            except ValueError:
                return Response({'error': 'Invalid advance_override'}, status=400)
        else:
            advance_amount = adv.amount

        return Response({
            'advance_id': adv.id,
            'advance_date': str(adv.date),
            'advance_amount': advance_amount,
            'balance_paid': adv.balance_paid,
            'total_paid_to_vendor': advance_amount + adv.balance_paid,
            'start_date': str(start),
            'end_date': str(end),
            'user': {
                'email': request.user.email,
                'name': f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email,
            },
            'purchases': PurchaseSerializer(purchases, many=True).data,
            'total_purchases': total_purchases,
            'remaining_balance': advance_amount - total_purchases,
            'generated_at': datetime.now().isoformat(),
        })

    @action(detail=False, methods=['get'])
    def session_bill(self, request):
        """Legacy endpoint — redirects to cycle_bill logic."""
        return self.cycle_bill(request)


@api_view(['POST'])
@set_permission_classes([permissions.AllowAny])
def register(request):
    email = request.data.get('email')
    password = request.data.get('password')
    first_name = request.data.get('first_name', '')
    last_name = request.data.get('last_name', '')
    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(email=email).exists():
        return Response({'error': 'User with this email already exists'}, status=status.HTTP_400_BAD_REQUEST)
    user = User.objects.create_user(username=email, email=email, password=password,
                                    first_name=first_name, last_name=last_name)
    return Response({'message': 'User registered successfully', 'user': UserSerializer(user).data},
                    status=status.HTTP_201_CREATED)


@api_view(['POST'])
@set_permission_classes([permissions.AllowAny])
def login_view(request):
    email = request.data.get('email') or request.data.get('username')
    password = request.data.get('password')
    if not email or not password:
        return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        user = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)
    user = authenticate(request, username=user.username, password=password)
    if user is None:
        return Response({'error': 'Invalid email or password'}, status=status.HTTP_401_UNAUTHORIZED)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'message': 'Login successful', 'token': token.key, 'user': UserSerializer(user).data})


@api_view(['POST'])
def logout_view(request):
    if request.user.is_authenticated:
        Token.objects.filter(user=request.user).delete()
    return Response({'message': 'Logout successful'})


@api_view(['GET'])
def current_user(request):
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(UserSerializer(request.user).data)


class MedicineViewSet(viewsets.ModelViewSet):
    serializer_class = MedicineSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Medicine.objects.filter(user=self.request.user)
        patient_id = self.request.query_params.get('patient')
        if patient_id == 'unassigned':
            qs = qs.filter(patient__isnull=True)
        elif patient_id:
            qs = qs.filter(patient_id=patient_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def alerts(self, request):
        medicines = self.get_queryset()
        s = MedicineSerializer(medicines, many=True)
        alerts = [m for m in s.data if m['alert_level'] != 'ok']
        return Response(alerts)

    @action(detail=True, methods=['post'])
    def add_stock(self, request, pk=None):
        medicine = self.get_object()
        qty = request.data.get('quantity')
        notes = request.data.get('notes', '')
        if qty is None:
            return Response({'error': 'quantity is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            qty = Decimal(str(qty))
        except (TypeError, ValueError):
            return Response({'error': 'quantity must be a number'}, status=status.HTTP_400_BAD_REQUEST)
        if qty <= 0:
            return Response({'error': 'quantity must be positive'}, status=status.HTTP_400_BAD_REQUEST)
        medicine.current_stock += qty
        medicine.save()
        StockTransaction.objects.create(medicine=medicine, type='add', quantity=qty, notes=notes)
        return Response(MedicineSerializer(medicine).data)

    @action(detail=True, methods=['post'])
    def consume(self, request, pk=None):
        medicine = self.get_object()
        qty = request.data.get('quantity', medicine.dosage_per_intake)
        discard_qty = request.data.get('discard_qty')   # optional: extra discarded half
        notes = request.data.get('notes', 'Marked taken')
        try:
            qty = Decimal(str(qty))
        except (TypeError, ValueError):
            return Response({'error': 'quantity must be a number'}, status=status.HTTP_400_BAD_REQUEST)
        if qty <= 0:
            return Response({'error': 'quantity must be positive'}, status=status.HTTP_400_BAD_REQUEST)

        discard = Decimal('0')
        if discard_qty is not None:
            try:
                discard = Decimal(str(discard_qty))
            except (TypeError, ValueError):
                return Response({'error': 'discard_qty must be a number'}, status=status.HTTP_400_BAD_REQUEST)

        total_needed = qty + discard
        if medicine.current_stock < total_needed:
            return Response({'error': 'Not enough stock'}, status=status.HTTP_400_BAD_REQUEST)

        medicine.current_stock -= total_needed
        medicine.save()
        slot = request.data.get('slot', '')
        StockTransaction.objects.create(medicine=medicine, type='consume', quantity=qty, notes=notes, slot=slot)
        if discard > 0:
            StockTransaction.objects.create(medicine=medicine, type='discard', quantity=discard, notes='Discarded broken half', slot=slot)
        return Response(MedicineSerializer(medicine).data)

    @action(detail=True, methods=['post'])
    def discard(self, request, pk=None):
        medicine = self.get_object()
        qty = request.data.get('quantity')
        notes = request.data.get('notes', 'Discarded')
        if qty is None:
            return Response({'error': 'quantity is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            qty = Decimal(str(qty))
        except (TypeError, ValueError):
            return Response({'error': 'quantity must be a number'}, status=status.HTTP_400_BAD_REQUEST)
        if qty <= 0:
            return Response({'error': 'quantity must be positive'}, status=status.HTTP_400_BAD_REQUEST)
        if medicine.current_stock < qty:
            return Response({'error': 'Not enough stock'}, status=status.HTTP_400_BAD_REQUEST)
        medicine.current_stock -= qty
        medicine.save()
        StockTransaction.objects.create(medicine=medicine, type='discard', quantity=qty, notes=notes)
        return Response(MedicineSerializer(medicine).data)

    @action(detail=True, methods=['post'])
    def unconsume(self, request, pk=None):
        """Reverse a consume transaction for a given slot and date."""
        medicine = self.get_object()
        slot = request.data.get('slot', '')
        date_str = request.data.get('date')
        if not date_str:
            return Response({'error': 'date is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            from datetime import datetime as dt
            target_date = dt.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'error': 'date must be YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

        txn = StockTransaction.objects.filter(
            medicine=medicine,
            type='consume',
            slot=slot,
            date__date=target_date,
        ).order_by('-date').first()

        if not txn:
            return Response({'error': 'No consume transaction found for this slot/date'}, status=status.HTTP_404_NOT_FOUND)

        medicine.current_stock += txn.quantity
        medicine.save()
        txn.delete()
        return Response(MedicineSerializer(medicine).data)

    @action(detail=True, methods=['post'])
    def adjust(self, request, pk=None):
        medicine = self.get_object()
        qty = request.data.get('quantity')
        notes = request.data.get('notes', '')
        if qty is None:
            return Response({'error': 'quantity is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            qty = Decimal(str(qty))
        except (TypeError, ValueError):
            return Response({'error': 'quantity must be a number'}, status=status.HTTP_400_BAD_REQUEST)
        new_stock = medicine.current_stock + qty
        if new_stock < 0:
            return Response({'error': 'Stock cannot go below 0'}, status=status.HTTP_400_BAD_REQUEST)
        medicine.current_stock = new_stock
        medicine.save()
        StockTransaction.objects.create(medicine=medicine, type='adjust', quantity=qty, notes=notes)
        return Response(MedicineSerializer(medicine).data)


class MedicineDiaryViewSet(viewsets.ViewSet):
    """Read-only diary of consumed medicines, filterable by patient and date."""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        txns = StockTransaction.objects.filter(
            type='consume',
            medicine__user=request.user,
        ).select_related('medicine', 'medicine__patient').order_by('-date')

        patient_id = request.query_params.get('patient_id')
        date_str = request.query_params.get('date')
        limit = int(request.query_params.get('limit', 100))

        if patient_id == '__household__':
            txns = txns.filter(medicine__patient__isnull=True)
        elif patient_id:
            try:
                txns = txns.filter(medicine__patient_id=int(patient_id))
            except (ValueError, TypeError):
                pass

        if date_str:
            try:
                d = datetime.strptime(date_str, '%Y-%m-%d').date()
                txns = txns.filter(date__date=d)
            except ValueError:
                pass

        return Response(StockTransactionSerializer(txns[:limit], many=True).data)


# ── Medicine Purchase ViewSet ──────────────────────────────────────────────────

class MedicinePurchaseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MedicinePurchaseSerializer

    def get_queryset(self):
        return MedicinePurchase.objects.filter(user=self.request.user).prefetch_related('items__medicine')

    def perform_create(self, serializer):
        purchase = serializer.save(user=self.request.user)
        self._auto_add_stock(purchase)

    def perform_update(self, serializer):
        purchase = serializer.save()
        self._auto_add_stock(purchase)

    def _auto_add_stock(self, purchase):
        for item in purchase.items.select_related('medicine'):
            if item.medicine:
                item.medicine.current_stock += item.quantity
                item.medicine.save()
                StockTransaction.objects.create(
                    medicine=item.medicine,
                    type='add',
                    quantity=item.quantity,
                    notes=f'Purchase from {purchase.purchased_from}',
                )

    @action(detail=False, methods=['get'])
    def trends(self, request):
        from django.db.models.functions import TruncMonth
        from django.db.models import Count
        qs = MedicinePurchase.objects.filter(user=request.user)
        start = request.query_params.get('start')
        end = request.query_params.get('end')
        if start:
            try:
                qs = qs.filter(purchase_date__gte=datetime.strptime(start, '%Y-%m-%d').date())
            except ValueError:
                pass
        if end:
            try:
                qs = qs.filter(purchase_date__lte=datetime.strptime(end, '%Y-%m-%d').date())
            except ValueError:
                pass
        monthly = (
            qs.annotate(month=TruncMonth('purchase_date'))
            .values('month')
            .annotate(total=Sum('total_amount'), count=Count('id'))
            .order_by('month')
        )
        return Response([
            {'month': r['month'].strftime('%Y-%m'), 'total': float(r['total'] or 0), 'count': r['count']}
            for r in monthly
        ])


# ── Consulting Record ViewSet ─────────────────────────────────────────────────

class ConsultingRecordViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ConsultingRecordSerializer

    def get_queryset(self):
        qs = ConsultingRecord.objects.filter(user=self.request.user).select_related('patient')
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        upcoming = self.request.query_params.get('upcoming')
        if upcoming:
            qs = qs.filter(next_appointment_date__gte=date.today()).order_by('next_appointment_date')
        limit = self.request.query_params.get('limit')
        if limit:
            try:
                return qs[:int(limit)]
            except ValueError:
                pass
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


# ── Health Expense ViewSet ────────────────────────────────────────────────────

class HealthExpenseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = HealthExpenseSerializer

    def get_queryset(self):
        qs = HealthExpense.objects.filter(user=self.request.user).select_related('patient')
        patient_id = self.request.query_params.get('patient_id')
        expense_type = self.request.query_params.get('expense_type')
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if expense_type:
            qs = qs.filter(expense_type=expense_type)
        if start:
            try:
                qs = qs.filter(expense_date__gte=datetime.strptime(start, '%Y-%m-%d').date())
            except ValueError:
                pass
        if end:
            try:
                qs = qs.filter(expense_date__lte=datetime.strptime(end, '%Y-%m-%d').date())
            except ValueError:
                pass
        paid_by = self.request.query_params.get('paid_by')
        if paid_by:
            qs = qs.filter(paid_by__iexact=paid_by)
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def summary(self, request):
        from django.db.models.functions import TruncMonth
        qs = self.get_queryset()
        total = qs.aggregate(total=Sum('amount'))['total'] or 0
        by_type = list(qs.values('expense_type').annotate(total=Sum('amount')).order_by('-total'))
        by_patient = list(qs.values('patient__name').annotate(total=Sum('amount')).order_by('-total'))
        by_payer = list(
            qs.values('paid_by').annotate(total=Sum('amount')).order_by('-total')
        )
        by_month_raw = list(
            qs.annotate(month=TruncMonth('expense_date'))
            .values('month', 'expense_type')
            .annotate(total=Sum('amount'))
            .order_by('month')
        )
        monthly_map = {}
        for r in by_month_raw:
            m = r['month'].strftime('%Y-%m')
            if m not in monthly_map:
                monthly_map[m] = {'month': m, 'total': 0, 'by_type': {}}
            monthly_map[m]['total'] += float(r['total'] or 0)
            monthly_map[m]['by_type'][r['expense_type']] = float(r['total'] or 0)
        return Response({
            'total': float(total),
            'by_type': [{'type': r['expense_type'], 'total': float(r['total'] or 0)} for r in by_type],
            'by_patient': [{'patient': r['patient__name'] or 'Household', 'total': float(r['total'] or 0)} for r in by_patient],
            'by_payer': [{'payer': r['paid_by'] or 'Unspecified', 'total': float(r['total'] or 0)} for r in by_payer],
            'by_month': sorted(monthly_map.values(), key=lambda x: x['month']),
        })


# ── Vital Reading ViewSet ─────────────────────────────────────────────────────

class VitalReadingViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = VitalReadingSerializer

    def get_queryset(self):
        qs = VitalReading.objects.filter(user=self.request.user).select_related('patient')
        patient_id = self.request.query_params.get('patient_id')
        start = self.request.query_params.get('start')
        end = self.request.query_params.get('end')
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
        if start:
            try:
                qs = qs.filter(recorded_at__date__gte=datetime.strptime(start, '%Y-%m-%d').date())
            except ValueError:
                pass
        if end:
            try:
                qs = qs.filter(recorded_at__date__lte=datetime.strptime(end, '%Y-%m-%d').date())
            except ValueError:
                pass
        return qs

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=False, methods=['get'])
    def averages(self, request):
        from django.db.models import Avg
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            return Response({'error': 'patient_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        qs = self.get_queryset()
        bp_avg = qs.filter(systolic__isnull=False).aggregate(
            avg_sys=Avg('systolic'), avg_dia=Avg('diastolic')
        )
        pulse_avg = qs.filter(pulse__isnull=False).aggregate(avg_pulse=Avg('pulse'))
        sugar_avgs = list(
            qs.filter(blood_sugar__isnull=False)
            .values('sugar_type', 'sugar_unit')
            .annotate(avg_sugar=Avg('blood_sugar'))
        )
        return Response({
            'systolic_avg': round(bp_avg['avg_sys'], 1) if bp_avg['avg_sys'] else None,
            'diastolic_avg': round(bp_avg['avg_dia'], 1) if bp_avg['avg_dia'] else None,
            'pulse_avg': round(pulse_avg['avg_pulse'], 1) if pulse_avg['avg_pulse'] else None,
            'sugar_avgs': [
                {'type': r['sugar_type'], 'unit': r['sugar_unit'], 'avg': round(float(r['avg_sugar']), 1)}
                for r in sugar_avgs
            ],
        })

    @action(detail=False, methods=['get'])
    def trends(self, request):
        qs = self.get_queryset().order_by('recorded_at')
        return Response(VitalReadingSerializer(qs, many=True).data)
