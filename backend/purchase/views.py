from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action, api_view, permission_classes as set_permission_classes
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth.models import User
from django.contrib.auth import authenticate
from django.db.models import Sum
from datetime import datetime, date

from .models import Item, Purchase, Advance, SpecialRequest, BillingSession
from .serializers import (
    UserSerializer, ItemSerializer, PurchaseSerializer,
    AdvanceSerializer, SpecialRequestSerializer, BillingSessionSerializer
)


def get_latest_advance(user):
    """Return the most recent advance payment for this user (= current cycle)."""
    return Advance.objects.filter(user=user).order_by('-date', '-created_at').first()


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


class SpecialRequestViewSet(viewsets.ModelViewSet):
    serializer_class = SpecialRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return SpecialRequest.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


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
