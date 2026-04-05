from django.contrib import admin
from .models import Item, Purchase, Advance, SpecialRequest

@admin.register(Item)
class ItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'price', 'unit')
    search_fields = ('name',)

@admin.register(Purchase)
class PurchaseAdmin(admin.ModelAdmin):
    list_display = ('user', 'item', 'quantity', 'date', 'total')
    list_filter = ('date', 'user')
    search_fields = ('user__email', 'item__name')

@admin.register(Advance)
class AdvanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'date', 'description')
    list_filter = ('date', 'user')
    search_fields = ('user__email',)

@admin.register(SpecialRequest)
class SpecialRequestAdmin(admin.ModelAdmin):
    list_display = ('user', 'item', 'quantity', 'delivery_date', 'status')
    list_filter = ('status', 'delivery_date', 'user')
    search_fields = ('user__email', 'item__name')
