from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    Item, Purchase, Advance, SpecialRequest, BillingSession,
    LpgConfig, LpgBooking, LpgUsage, Medicine, StockTransaction, Patient,
    MedicinePurchase, MedicinePurchaseItem, ConsultingRecord,
    HealthExpense, VitalReading,
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
        fields = ['id', 'name', 'price', 'unit', 'category']


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
