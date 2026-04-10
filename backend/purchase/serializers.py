from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Item, Purchase, Advance, SpecialRequest, BillingSession, LpgConfig, LpgBooking, LpgUsage


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


class SpecialRequestSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = SpecialRequest
        fields = ['id', 'user', 'item', 'item_name', 'quantity', 'requested_date',
                  'delivery_date', 'description', 'status']
