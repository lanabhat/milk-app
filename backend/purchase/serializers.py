from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    Item, Purchase, Advance, SpecialRequest, BillingSession,
    LpgConfig, LpgBooking, LpgUsage, Medicine, StockTransaction, Patient,
    MedicinePurchase, MedicinePurchaseItem, ConsultingRecord,
    HealthExpense, VitalReading,
    Vehicle, OdometerReading, FuelLog, ServiceCenter, ServiceRecord, ServicePart,
    PuccRecord, InsurancePolicy, InsuranceClaim, TyrePressureLog, OilChangeLog,
    AccessorySpend, TripLog, ExtendedWarranty, PartReplacement,
    FamilyMember, DiaryEntry, EntryNote, EntryExpense,
    HomeAppliance, ApplianceService, ElectricityBill,
    SpendCategory, HomeSpend, EducationExpense,
    LendingLog, PaybackLog,
)


class BillingSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = BillingSession
        fields = ['id', 'start_date', 'end_date', 'opening_advance', 'status', 'created_at']


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name']


class ItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = Item
        fields = ['id', 'name', 'price', 'unit', 'category', 'visible', 'position']


class PurchaseSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = Purchase
        fields = ['id', 'user', 'item', 'item_name', 'quantity', 'date', 'total', 'session', 'advance']
        read_only_fields = ['user', 'total', 'session']

    def create(self, validated_data):
        validated_data['total'] = validated_data['quantity'] * validated_data['item'].price
        return Purchase.objects.create(**validated_data)

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.total = instance.quantity * instance.item.price
        instance.save()
        return instance


class AdvanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Advance
        fields = ['id', 'user', 'amount', 'balance_paid', 'date', 'description', 'session']
        read_only_fields = ['user', 'session']


class LpgConfigSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        total = attrs.get('total_cylinders', getattr(self.instance, 'total_cylinders', 1))
        filled = attrs.get('filled_cylinders', getattr(self.instance, 'filled_cylinders', 1))
        empty = attrs.get('empty_cylinders', getattr(self.instance, 'empty_cylinders', 0))

        if filled + empty > total:
            raise serializers.ValidationError('Filled and empty cylinders cannot exceed total cylinders.')
        return attrs

    class Meta:
        model = LpgConfig
        fields = ['waiting_days', 'total_cylinders', 'filled_cylinders', 'empty_cylinders', 'liters_per_cylinder']


class LpgBookingSerializer(serializers.ModelSerializer):
    class Meta:
        model = LpgBooking
        fields = ['id', 'booking_date', 'delivered_date', 'price', 'notes', 'created_at']
        read_only_fields = ['created_at']


class LpgUsageSerializer(serializers.ModelSerializer):
    booking_date = serializers.DateField(source='booking.booking_date', read_only=True)

    class Meta:
        model = LpgUsage
        fields = ['id', 'booking', 'booking_date', 'start_date', 'end_date', 'price', 'notes', 'created_at']
        read_only_fields = ['created_at']


class PatientSerializer(serializers.ModelSerializer):
    medicine_count = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id', 'name', 'relation', 'treatment_type',
            'notes', 'active', 'created_at', 'updated_at',
            'medicine_count',
        ]
        read_only_fields = ['created_at', 'updated_at', 'medicine_count']

    def get_medicine_count(self, obj):
        return obj.medicines.count()


class MedicineSerializer(serializers.ModelSerializer):
    daily_usage = serializers.SerializerMethodField()
    days_left = serializers.SerializerMethodField()
    alert_level = serializers.SerializerMethodField()
    patient = serializers.PrimaryKeyRelatedField(queryset=Patient.objects.all(), allow_null=True, required=False)
    patient_name = serializers.CharField(source='patient.name', read_only=True, allow_null=True)

    class Meta:
        model = Medicine
        fields = [
            'id', 'medicine_name', 'brand_name', 'strength', 'type',
            'morning_dose', 'afternoon_dose', 'evening_dose', 'night_dose',
            'dosage_per_intake', 'intakes_per_day', 'timing', 'food_relation',
            'current_stock', 'unit', 'low_stock_threshold',
            'prescribed_by', 'specialty',
            'last_updated', 'created_at',
            'daily_usage', 'days_left', 'alert_level',
            'patient', 'patient_name',
        ]
        read_only_fields = ['last_updated', 'created_at', 'daily_usage', 'days_left', 'alert_level', 'patient_name']

    def _slot_daily(self, obj):
        """Sum of all per-slot doses. Returns None if no slots configured."""
        slots = [obj.morning_dose, obj.afternoon_dose, obj.evening_dose, obj.night_dose]
        configured = [float(d) for d in slots if d is not None]
        if not configured:
            return None
        return sum(configured)

    def get_daily_usage(self, obj):
        slot_total = self._slot_daily(obj)
        if slot_total is not None:
            return slot_total
        return float(obj.dosage_per_intake * obj.intakes_per_day)

    def get_days_left(self, obj):
        daily = self.get_daily_usage(obj)
        if not daily:
            return None
        return round(float(obj.current_stock) / daily, 1)

    def get_alert_level(self, obj):
        days_left = self.get_days_left(obj)
        if days_left is not None and days_left <= 2:
            return 'critical'
        if float(obj.current_stock) <= float(obj.low_stock_threshold):
            return 'low'
        return 'ok'


class StockTransactionSerializer(serializers.ModelSerializer):
    medicine_name = serializers.CharField(source='medicine.medicine_name', read_only=True)
    patient_name = serializers.CharField(source='medicine.patient.name', read_only=True, allow_null=True)
    patient_id = serializers.IntegerField(source='medicine.patient_id', read_only=True, allow_null=True)

    class Meta:
        model = StockTransaction
        fields = ['id', 'medicine', 'medicine_name', 'patient_id', 'patient_name', 'type', 'quantity', 'date', 'notes', 'slot']
        read_only_fields = ['date', 'medicine_name', 'patient_name', 'patient_id']


class SpecialRequestSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = SpecialRequest
        fields = ['id', 'user', 'item', 'item_name', 'quantity', 'requested_date',
                  'delivery_date', 'description', 'status']


# ── Medicine Purchase serializers ─────────────────────────────────────────────

class MedicinePurchaseItemSerializer(serializers.ModelSerializer):
    medicine_display = serializers.SerializerMethodField()

    class Meta:
        model = MedicinePurchaseItem
        fields = ['id', 'medicine', 'medicine_name', 'medicine_display', 'quantity', 'unit_cost', 'total_cost']

    def get_medicine_display(self, obj):
        if obj.medicine:
            return obj.medicine.medicine_name
        return obj.medicine_name


class MedicinePurchaseSerializer(serializers.ModelSerializer):
    items = MedicinePurchaseItemSerializer(many=True)
    patient_name = serializers.CharField(source='patient.name', read_only=True, allow_null=True)

    class Meta:
        model = MedicinePurchase
        fields = [
            'id', 'patient', 'patient_name', 'purchase_date', 'purchased_from',
            'bill_number', 'paid_by', 'payment_method', 'total_amount', 'notes',
            'created_at', 'items',
        ]
        read_only_fields = ['created_at', 'patient_name']

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        purchase = MedicinePurchase.objects.create(**validated_data)
        for item_data in items_data:
            item_data['total_cost'] = item_data.get('quantity', 0) * item_data.get('unit_cost', 0)
            MedicinePurchaseItem.objects.create(purchase=purchase, **item_data)
        return purchase

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if items_data is not None:
            instance.items.all().delete()
            for item_data in items_data:
                item_data['total_cost'] = item_data.get('quantity', 0) * item_data.get('unit_cost', 0)
                MedicinePurchaseItem.objects.create(purchase=instance, **item_data)
        return instance


# ── Consulting Record serializer ──────────────────────────────────────────────

class ConsultingRecordSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    days_until_next = serializers.SerializerMethodField()

    class Meta:
        model = ConsultingRecord
        fields = [
            'id', 'patient', 'patient_name', 'doctor_name', 'specialty', 'hospital',
            'consultation_date', 'next_appointment_date', 'days_until_next',
            'fee', 'payment_method', 'notes', 'instructions', 'created_at',
        ]
        read_only_fields = ['created_at', 'patient_name', 'days_until_next']

    def get_days_until_next(self, obj):
        if not obj.next_appointment_date:
            return None
        delta = obj.next_appointment_date - timezone.now().date()
        return delta.days


# ── Health Expense serializer ─────────────────────────────────────────────────

class HealthExpenseSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.name', read_only=True, allow_null=True)

    class Meta:
        model = HealthExpense
        fields = [
            'id', 'patient', 'patient_name', 'expense_type', 'description',
            'expense_date', 'amount', 'payment_method', 'paid_by', 'reference_id', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at', 'patient_name']


# ── Vital Reading serializer ──────────────────────────────────────────────────

class VitalReadingSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    bp_display = serializers.SerializerMethodField()

    class Meta:
        model = VitalReading
        fields = [
            'id', 'patient', 'patient_name', 'recorded_at',
            'systolic', 'diastolic', 'bp_display', 'pulse',
            'blood_sugar', 'sugar_unit', 'sugar_type',
            'food_time', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at', 'patient_name', 'bp_display']

    def get_bp_display(self, obj):
        if obj.systolic is not None and obj.diastolic is not None:
            return f"{obj.systolic}/{obj.diastolic}"
        return None

    def validate(self, attrs):
        has_bp = attrs.get('systolic') is not None or attrs.get('diastolic') is not None
        has_pulse = attrs.get('pulse') is not None
        has_sugar = attrs.get('blood_sugar') is not None
        if not (has_bp or has_pulse or has_sugar):
            raise serializers.ValidationError('At least one vital (BP, pulse, or blood sugar) must be provided.')
        return attrs


# ── Vehicle Fleet Serializers ─────────────────────────────────────────────────

class VehicleSerializer(serializers.ModelSerializer):
    days_until_pucc_expiry      = serializers.SerializerMethodField()
    days_until_insurance_expiry = serializers.SerializerMethodField()
    days_until_next_service     = serializers.SerializerMethodField()
    days_until_oil_change       = serializers.SerializerMethodField()
    days_until_warranty_expiry  = serializers.SerializerMethodField()

    class Meta:
        model  = Vehicle
        fields = [
            'id', 'make', 'model', 'year', 'registration_no', 'color', 'vin_number',
            'fuel_type', 'vehicle_type', 'purchase_date', 'image_url',
            'current_odometer', 'is_active', 'notes', 'created_at',
            'days_until_pucc_expiry', 'days_until_insurance_expiry',
            'days_until_next_service', 'days_until_oil_change', 'days_until_warranty_expiry',
        ]
        read_only_fields = ['created_at', 'days_until_pucc_expiry',
                            'days_until_insurance_expiry', 'days_until_next_service',
                            'days_until_oil_change', 'days_until_warranty_expiry']

    def _days_until(self, date_val):
        if not date_val:
            return None
        from django.utils import timezone
        delta = date_val - timezone.now().date()
        return delta.days

    def get_days_until_pucc_expiry(self, obj):
        latest = obj.pucc_records.order_by('-expiry_date').first()
        return self._days_until(latest.expiry_date) if latest else None

    def get_days_until_insurance_expiry(self, obj):
        latest = obj.insurance_policies.order_by('-end_date').first()
        return self._days_until(latest.end_date) if latest else None

    def get_days_until_next_service(self, obj):
        latest = obj.service_records.filter(next_service_date__isnull=False).order_by('-date').first()
        return self._days_until(latest.next_service_date) if latest else None

    def get_days_until_oil_change(self, obj):
        latest = obj.oil_changes.filter(next_change_date__isnull=False).order_by('-date').first()
        return self._days_until(latest.next_change_date) if latest else None

    def get_days_until_warranty_expiry(self, obj):
        latest = obj.extended_warranties.order_by('-end_date').first()
        return self._days_until(latest.end_date) if latest else None


class OdometerReadingSerializer(serializers.ModelSerializer):
    class Meta:
        model  = OdometerReading
        fields = ['id', 'vehicle', 'reading', 'date', 'notes', 'created_at']
        read_only_fields = ['created_at']


class FuelLogSerializer(serializers.ModelSerializer):
    mileage = serializers.SerializerMethodField()

    class Meta:
        model  = FuelLog
        fields = [
            'id', 'vehicle', 'date', 'fuel_amount', 'price_per_litre',
            'total_cost', 'odometer', 'full_tank', 'fuel_station', 'notes',
            'created_at', 'mileage',
        ]
        read_only_fields = ['created_at', 'mileage']

    def get_mileage(self, obj):
        if not obj.full_tank:
            return None
        prev = FuelLog.objects.filter(
            vehicle=obj.vehicle, full_tank=True, odometer__lt=obj.odometer
        ).order_by('-odometer').first()
        if prev and prev.odometer and obj.fuel_amount:
            km = obj.odometer - prev.odometer
            return round(km / obj.fuel_amount, 2)
        return None


class ServiceCenterSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ServiceCenter
        fields = ['id', 'name', 'address', 'phone', 'notes', 'created_at']
        read_only_fields = ['created_at']


class ServicePartSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ServicePart
        fields = ['id', 'part_name', 'part_number', 'manufacturer', 'quantity', 'unit_cost', 'total_cost']


class ServiceRecordSerializer(serializers.ModelSerializer):
    parts              = ServicePartSerializer(many=True, required=False)
    service_center_name = serializers.CharField(source='service_center.name', read_only=True, allow_null=True)

    class Meta:
        model  = ServiceRecord
        fields = [
            'id', 'vehicle', 'service_center', 'service_center_name', 'date',
            'service_type', 'odometer', 'description', 'labour_cost',
            'parts_cost', 'total_cost', 'next_service_date', 'next_service_km',
            'notes', 'parts', 'created_at',
        ]
        read_only_fields = ['created_at', 'service_center_name']

    def create(self, validated_data):
        parts_data = validated_data.pop('parts', [])
        record = ServiceRecord.objects.create(**validated_data)
        parts_total = 0
        for p in parts_data:
            part = ServicePart.objects.create(service_record=record, **p)
            parts_total += part.total_cost
        if parts_data:
            record.parts_cost = parts_total
            record.total_cost = record.labour_cost + parts_total
            record.save(update_fields=['parts_cost', 'total_cost'])
        return record

    def update(self, instance, validated_data):
        parts_data = validated_data.pop('parts', None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()
        if parts_data is not None:
            instance.parts.all().delete()
            parts_total = 0
            for p in parts_data:
                part = ServicePart.objects.create(service_record=instance, **p)
                parts_total += part.total_cost
            instance.parts_cost = parts_total
            instance.total_cost = instance.labour_cost + parts_total
            instance.save(update_fields=['parts_cost', 'total_cost'])
        return instance


class PuccRecordSerializer(serializers.ModelSerializer):
    days_until_expiry = serializers.SerializerMethodField()

    class Meta:
        model  = PuccRecord
        fields = ['id', 'vehicle', 'issue_date', 'expiry_date', 'certificate_no',
                  'test_center', 'cost', 'notes', 'created_at', 'days_until_expiry']
        read_only_fields = ['created_at', 'days_until_expiry']

    def get_days_until_expiry(self, obj):
        from django.utils import timezone
        return (obj.expiry_date - timezone.now().date()).days


class InsurancePolicySerializer(serializers.ModelSerializer):
    days_until_expiry = serializers.SerializerMethodField()

    class Meta:
        model  = InsurancePolicy
        fields = [
            'id', 'vehicle', 'provider', 'policy_number', 'policy_type',
            'start_date', 'end_date', 'premium', 'insured_value',
            'agent_name', 'agent_phone', 'notes', 'created_at', 'days_until_expiry',
        ]
        read_only_fields = ['created_at', 'days_until_expiry']

    def get_days_until_expiry(self, obj):
        from django.utils import timezone
        return (obj.end_date - timezone.now().date()).days


class InsuranceClaimSerializer(serializers.ModelSerializer):
    class Meta:
        model  = InsuranceClaim
        fields = [
            'id', 'policy', 'vehicle', 'claim_date', 'incident_date',
            'description', 'claimed_amount', 'approved_amount',
            'settlement_date', 'status', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at']


class TyrePressureLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = TyrePressureLog
        fields = ['id', 'vehicle', 'date', 'front_left', 'front_right',
                  'rear_left', 'rear_right', 'spare', 'notes', 'created_at']
        read_only_fields = ['created_at']


class OilChangeLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = OilChangeLog
        fields = [
            'id', 'vehicle', 'date', 'odometer', 'oil_brand', 'oil_grade',
            'oil_amount', 'cost', 'next_change_date', 'next_change_km',
            'notes', 'created_at',
        ]
        read_only_fields = ['created_at']


class AccessorySpendSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AccessorySpend
        fields = ['id', 'vehicle', 'date', 'item_name', 'category', 'cost',
                  'vendor', 'notes', 'created_at']
        read_only_fields = ['created_at']


class TripLogSerializer(serializers.ModelSerializer):
    computed_distance = serializers.SerializerMethodField()

    class Meta:
        model  = TripLog
        fields = [
            'id', 'vehicle', 'trip_date', 'title', 'from_location', 'to_location',
            'start_odometer', 'end_odometer', 'distance_km', 'purpose',
            'image_url', 'notes', 'is_draft', 'created_at', 'updated_at',
            'computed_distance',
        ]
        read_only_fields = ['created_at', 'updated_at', 'computed_distance']

    def get_computed_distance(self, obj):
        if obj.distance_km is not None:
            return obj.distance_km
        if obj.start_odometer is not None and obj.end_odometer is not None:
            return round(obj.end_odometer - obj.start_odometer, 1)
        return None


class ExtendedWarrantySerializer(serializers.ModelSerializer):
    days_until_expiry = serializers.SerializerMethodField()

    class Meta:
        model  = ExtendedWarranty
        fields = [
            'id', 'vehicle', 'provider', 'contract_number', 'start_date', 'end_date',
            'coverage_description', 'max_claim_amount', 'contact_phone', 'cost',
            'notes', 'created_at', 'days_until_expiry',
        ]
        read_only_fields = ['created_at', 'days_until_expiry']

    def get_days_until_expiry(self, obj):
        from django.utils import timezone
        return (obj.end_date - timezone.now().date()).days


class PartReplacementSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PartReplacement
        fields = [
            'id', 'vehicle', 'date', 'part_name', 'part_number', 'manufacturer',
            'cost', 'vendor', 'odometer', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at']


# ── Journal Serializers ───────────────────────────────────────────────────────

class FamilyMemberSerializer(serializers.ModelSerializer):
    class Meta:
        model  = FamilyMember
        fields = ['id', 'name', 'relation', 'avatar', 'is_active', 'created_at']
        read_only_fields = ['created_at']


class EntryNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = EntryNote
        fields = ['id', 'entry', 'content', 'created_at']
        read_only_fields = ['created_at']


class EntryExpenseSerializer(serializers.ModelSerializer):
    paid_by_name = serializers.CharField(source='paid_by.name', read_only=True, allow_null=True)

    class Meta:
        model  = EntryExpense
        fields = ['id', 'entry', 'description', 'amount', 'date', 'payment_method',
                  'paid_by', 'paid_by_name', 'notes', 'created_at']
        read_only_fields = ['created_at', 'paid_by_name']


class DiaryEntrySerializer(serializers.ModelSerializer):
    notes         = EntryNoteSerializer(many=True, read_only=True)
    expenses      = EntryExpenseSerializer(many=True, read_only=True)
    owner_name    = serializers.CharField(source='owner.name', read_only=True, allow_null=True)
    owner_avatar  = serializers.CharField(source='owner.avatar', read_only=True, allow_null=True)
    related_trip_title = serializers.CharField(source='related_trip.title', read_only=True, allow_null=True)
    expense_total = serializers.SerializerMethodField()

    class Meta:
        model  = DiaryEntry
        fields = [
            'id', 'entry_type', 'title', 'content', 'owner', 'owner_name', 'owner_avatar',
            'priority', 'criticality', 'status', 'due_date', 'completed_at',
            'related_trip', 'related_trip_title', 'tags',
            'entry_date', 'created_at', 'updated_at',
            'notes', 'expenses', 'expense_total',
        ]
        read_only_fields = ['created_at', 'updated_at', 'completed_at',
                            'owner_name', 'owner_avatar', 'related_trip_title', 'expense_total']

    def get_expense_total(self, obj):
        return sum(e.amount for e in obj.expenses.all())


# ── Home Management Serializers ───────────────────────────────────────────────

class HomeApplianceSerializer(serializers.ModelSerializer):
    days_until_warranty     = serializers.SerializerMethodField()
    days_until_amc          = serializers.SerializerMethodField()
    days_until_next_service = serializers.SerializerMethodField()

    class Meta:
        model  = HomeAppliance
        fields = [
            'id', 'name', 'brand', 'model_number', 'category',
            'purchase_date', 'purchase_price', 'warranty_expiry', 'amc_expiry',
            'serial_number', 'location', 'image_url', 'notes', 'is_active',
            'created_at', 'days_until_warranty', 'days_until_amc', 'days_until_next_service',
        ]
        read_only_fields = ['created_at', 'days_until_warranty', 'days_until_amc', 'days_until_next_service']

    def _days(self, d):
        if not d:
            return None
        from django.utils import timezone
        return (d - timezone.now().date()).days

    def get_days_until_warranty(self, obj):
        return self._days(obj.warranty_expiry)

    def get_days_until_amc(self, obj):
        return self._days(obj.amc_expiry)

    def get_days_until_next_service(self, obj):
        latest = obj.services.filter(next_service_date__isnull=False).order_by('-date').first()
        return self._days(latest.next_service_date) if latest else None


class ApplianceServiceSerializer(serializers.ModelSerializer):
    appliance_name = serializers.CharField(source='appliance.name', read_only=True)

    class Meta:
        model  = ApplianceService
        fields = [
            'id', 'appliance', 'appliance_name', 'date', 'service_type',
            'description', 'technician', 'company', 'cost',
            'next_service_date', 'bill_url', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at', 'appliance_name']


class ElectricityBillSerializer(serializers.ModelSerializer):
    cost_per_unit = serializers.SerializerMethodField()

    class Meta:
        model  = ElectricityBill
        fields = [
            'id', 'bill_date', 'from_date', 'to_date', 'units_consumed', 'amount',
            'opening_reading', 'closing_reading', 'meter_number',
            'paid', 'paid_date', 'notes', 'created_at', 'cost_per_unit',
        ]
        read_only_fields = ['created_at', 'cost_per_unit']

    def get_cost_per_unit(self, obj):
        if obj.units_consumed and obj.units_consumed > 0:
            return round(obj.amount / obj.units_consumed, 2)
        return None


class SpendCategorySerializer(serializers.ModelSerializer):
    spend_count = serializers.SerializerMethodField()

    class Meta:
        model  = SpendCategory
        fields = ['id', 'name', 'icon', 'color', 'created_at', 'spend_count']
        read_only_fields = ['created_at', 'spend_count']

    def get_spend_count(self, obj):
        return obj.spends.count()


class HomeSpendSerializer(serializers.ModelSerializer):
    category_name  = serializers.CharField(source='category.name',  read_only=True, allow_null=True)
    category_icon  = serializers.CharField(source='category.icon',  read_only=True, allow_null=True)
    category_color = serializers.CharField(source='category.color', read_only=True, allow_null=True)
    paid_by_name   = serializers.CharField(source='paid_by.name',   read_only=True, allow_null=True)

    class Meta:
        model  = HomeSpend
        fields = [
            'id', 'date', 'category', 'category_name', 'category_icon', 'category_color',
            'description', 'amount', 'store_name', 'paid_by', 'paid_by_name',
            'payment_method', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at', 'category_name', 'category_icon', 'category_color', 'paid_by_name']


class EducationExpenseSerializer(serializers.ModelSerializer):
    member_name   = serializers.CharField(source='family_member.name',   read_only=True, allow_null=True)
    member_avatar = serializers.CharField(source='family_member.avatar', read_only=True, allow_null=True)

    class Meta:
        model  = EducationExpense
        fields = [
            'id', 'family_member', 'member_name', 'member_avatar',
            'date', 'category', 'description', 'amount',
            'institution', 'academic_year', 'payment_method', 'notes', 'created_at',
        ]
        read_only_fields = ['created_at', 'member_name', 'member_avatar']


# ── Lending / IOU Serializers ─────────────────────────────────────────────────

class PaybackLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PaybackLog
        fields = ['id', 'lending', 'date', 'amount', 'notes', 'created_at']
        read_only_fields = ['created_at']


class LendingLogSerializer(serializers.ModelSerializer):
    paybacks        = PaybackLogSerializer(many=True, read_only=True)
    total_paid      = serializers.SerializerMethodField()
    outstanding     = serializers.SerializerMethodField()
    status          = serializers.SerializerMethodField()
    contact_display = serializers.SerializerMethodField()
    contact_avatar  = serializers.SerializerMethodField()

    class Meta:
        model  = LendingLog
        fields = [
            'id', 'contact', 'contact_name', 'contact_display', 'contact_avatar',
            'date', 'description', 'amount', 'notes', 'created_at', 'updated_at',
            'paybacks', 'total_paid', 'outstanding', 'status',
        ]
        read_only_fields = ['created_at', 'updated_at',
                            'total_paid', 'outstanding', 'status',
                            'contact_display', 'contact_avatar']

    def _total_paid(self, obj):
        return sum(p.amount for p in obj.paybacks.all())

    def get_total_paid(self, obj):
        return self._total_paid(obj)

    def get_outstanding(self, obj):
        return round(obj.amount - self._total_paid(obj), 2)

    def get_status(self, obj):
        paid = self._total_paid(obj)
        if paid <= 0:
            return 'outstanding'
        if paid < obj.amount:
            return 'partial'
        return 'settled'

    def get_contact_display(self, obj):
        return obj.contact.name if obj.contact else obj.contact_name or 'Unknown'

    def get_contact_avatar(self, obj):
        return obj.contact.avatar if obj.contact else ''
