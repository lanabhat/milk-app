from django.db import models
from django.contrib.auth.models import User


class BillingSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sessions')
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    opening_advance = models.FloatField(default=0)
    status = models.CharField(max_length=20, choices=[('active', 'Active'), ('settled', 'Settled')], default='active')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} - Session {self.id} ({self.status})"


ITEM_CATEGORIES = [
    ('milk',      'Milk & Dairy'),
    ('newspaper', 'Newspaper & Magazine'),
    ('other',     'Other'),
]

class Item(models.Model):
    name     = models.CharField(max_length=100)
    price    = models.FloatField()
    unit     = models.CharField(max_length=50)
    category = models.CharField(max_length=50, choices=ITEM_CATEGORIES, default='other', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.price} Rs per {self.unit}"

    class Meta:
        ordering = ['name']


class Purchase(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='purchases')
    session = models.ForeignKey(BillingSession, on_delete=models.SET_NULL, null=True, blank=True, related_name='purchases')
    advance = models.ForeignKey('Advance', on_delete=models.SET_NULL, null=True, blank=True, related_name='linked_purchases')
    item = models.ForeignKey(Item, on_delete=models.CASCADE, related_name='purchases')
    quantity = models.FloatField()
    date = models.DateField()
    total = models.FloatField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - {self.item.name} - {self.date}"

    class Meta:
        ordering = ['-date']


class Advance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='advances')
    session = models.ForeignKey(BillingSession, on_delete=models.SET_NULL, null=True, blank=True, related_name='advances')
    amount = models.FloatField()           # new advance given (fresh money)
    balance_paid = models.FloatField(default=0)  # extra paid to clear previous cycle dues
    date = models.DateField()
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} - ₹{self.amount} advance + ₹{self.balance_paid} balance - {self.date}"

    class Meta:
        ordering = ['-date', '-created_at']


class LpgConfig(models.Model):
    """One row per user — stores LPG preferences and cylinder stock."""
    user                = models.OneToOneField(User, on_delete=models.CASCADE, related_name='lpg_config')
    waiting_days        = models.PositiveIntegerField(default=21)
    total_cylinders     = models.PositiveIntegerField(default=1)
    filled_cylinders    = models.PositiveIntegerField(default=1)
    empty_cylinders     = models.PositiveIntegerField(default=0)
    liters_per_cylinder = models.FloatField(default=14.2)
    updated_at          = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.email} — {self.waiting_days}d waiting"


class LpgBooking(models.Model):
    user            = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lpg_bookings')
    booking_date    = models.DateField()
    delivered_date  = models.DateField(null=True, blank=True)
    price           = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    notes           = models.CharField(max_length=255, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-booking_date', '-created_at']

    def __str__(self):
        return f"{self.user.email} — booked {self.booking_date}"


class LpgUsage(models.Model):
    """Tracks when a cylinder is actually opened and used in the kitchen."""
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lpg_usages')
    booking    = models.ForeignKey(LpgBooking, on_delete=models.SET_NULL, null=True, blank=True, related_name='usages')
    start_date = models.DateField()
    end_date   = models.DateField(null=True, blank=True)
    price      = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    notes      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-start_date', '-created_at']

    def __str__(self):
        end = self.end_date or 'ongoing'
        return f"{self.user.email} — {self.start_date} → {end}"


class SpecialRequest(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='special_requests')
    item = models.ForeignKey(Item, on_delete=models.CASCADE)
    quantity = models.FloatField()
    requested_date = models.DateField()
    delivery_date = models.DateField()
    description = models.TextField(blank=True)
    STATUS_CHOICES = [
        ('pending', 'Pending'), ('confirmed', 'Confirmed'),
        ('delivered', 'Delivered'), ('cancelled', 'Cancelled'),
    ]
    status = models.CharField(max_length=50, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-requested_date']
