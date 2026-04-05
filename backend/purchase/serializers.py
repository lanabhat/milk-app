from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Item, Purchase, Advance, SpecialRequest, BillingSession


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


class SpecialRequestSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)

    class Meta:
        model = SpecialRequest
        fields = ['id', 'user', 'item', 'item_name', 'quantity', 'requested_date',
                  'delivery_date', 'description', 'status']
