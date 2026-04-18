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


RELATION_CHOICES = [
    ('mom',      'Mom'),
    ('dad',      'Dad'),
    ('son',      'Son'),
    ('daughter', 'Daughter'),
    ('other',    'Other'),
]

TREATMENT_CHOICES = [
    ('allopathic',  'Allopathic'),
    ('ayurvedic',   'Ayurvedic'),
    ('homeopathic', 'Homeopathic'),
    ('other',       'Other'),
]

TIMING_CHOICES = [
    ('morning',     'Morning'),
    ('afternoon',   'Afternoon'),
    ('evening',     'Evening'),
    ('night',       'Night'),
    ('as_needed',   'As Needed'),
]

FOOD_RELATION_CHOICES = [
    ('before_food', 'Before Food'),
    ('after_food',  'After Food'),
    ('with_food',   'With Food'),
    ('no_restriction', 'No Restriction'),
]


class Patient(models.Model):
    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='patients')
    name           = models.CharField(max_length=100)
    relation       = models.CharField(max_length=20, choices=RELATION_CHOICES, default='other')
    treatment_type = models.CharField(max_length=20, choices=TREATMENT_CHOICES, default='allopathic')
    notes          = models.TextField(blank=True)
    active         = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.user.email} — {self.name} ({self.relation})"


class Medicine(models.Model):
    UNIT_CHOICES = [('tablets', 'Tablets'), ('mg', 'mg'), ('ml', 'ml'), ('units', 'Units')]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='medicines')
    patient = models.ForeignKey('Patient', on_delete=models.SET_NULL, null=True, blank=True, related_name='medicines')
    medicine_name = models.CharField(max_length=100)
    brand_name = models.CharField(max_length=100, blank=True)
    strength = models.CharField(max_length=30, blank=True)   # e.g. "500mg", "10mg"
    type = models.CharField(max_length=20, default='tablet')
    # Per-slot schedule — null means not scheduled for that slot
    morning_dose   = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    afternoon_dose = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    evening_dose   = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    night_dose     = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    # Legacy single-slot fields kept for compatibility
    dosage_per_intake = models.DecimalField(max_digits=6, decimal_places=2, default=1)
    intakes_per_day = models.PositiveIntegerField(default=1)
    timing = models.CharField(max_length=20, choices=TIMING_CHOICES, default='morning', blank=True)
    food_relation = models.CharField(max_length=20, choices=FOOD_RELATION_CHOICES, default='no_restriction', blank=True)
    current_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='tablets')
    low_stock_threshold = models.DecimalField(max_digits=6, decimal_places=2, default=10)
    prescribed_by = models.CharField(max_length=100, blank=True)   # doctor name
    specialty     = models.CharField(max_length=100, blank=True)   # e.g. Cardiology
    last_updated = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['medicine_name']

    def __str__(self):
        return f"{self.user.email} — {self.medicine_name}"


class StockTransaction(models.Model):
    TYPE_CHOICES = [('add', 'Add'), ('consume', 'Consume'), ('adjust', 'Adjust'), ('discard', 'Discard')]
    SLOT_CHOICES = [('morning', 'Morning'), ('afternoon', 'Afternoon'), ('evening', 'Evening'), ('night', 'Night')]
    medicine = models.ForeignKey(Medicine, on_delete=models.CASCADE, related_name='transactions')
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateTimeField(auto_now_add=True)
    notes = models.CharField(max_length=200, blank=True)
    slot = models.CharField(max_length=10, choices=SLOT_CHOICES, blank=True, default='')

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.medicine.medicine_name} — {self.type} {self.quantity}"


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


# ── Medicine Purchases ────────────────────────────────────────────────────────

class MedicinePurchase(models.Model):
    PAYMENT_CHOICES = [('cash', 'Cash'), ('card', 'Card'), ('upi', 'UPI'), ('other', 'Other')]
    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='medicine_purchases')
    patient        = models.ForeignKey('Patient', on_delete=models.SET_NULL, null=True, blank=True, related_name='medicine_purchases')
    purchase_date  = models.DateField()
    purchased_from = models.CharField(max_length=100)
    bill_number    = models.CharField(max_length=50, blank=True)
    paid_by        = models.CharField(max_length=100, blank=True)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default='cash')
    total_amount   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    notes          = models.CharField(max_length=200, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-purchase_date', '-created_at']

    def __str__(self):
        return f"{self.purchased_from} — ₹{self.total_amount} on {self.purchase_date}"


class MedicinePurchaseItem(models.Model):
    purchase      = models.ForeignKey(MedicinePurchase, on_delete=models.CASCADE, related_name='items')
    medicine      = models.ForeignKey(Medicine, on_delete=models.SET_NULL, null=True, blank=True)
    medicine_name = models.CharField(max_length=100, blank=True)
    quantity      = models.DecimalField(max_digits=10, decimal_places=2)
    unit_cost     = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_cost    = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    def __str__(self):
        name = self.medicine.medicine_name if self.medicine else self.medicine_name
        return f"{name} × {self.quantity}"


# ── Consulting Records ────────────────────────────────────────────────────────

class ConsultingRecord(models.Model):
    PAYMENT_CHOICES = [
        ('cash', 'Cash'), ('card', 'Card'), ('upi', 'UPI'),
        ('insurance', 'Insurance'), ('other', 'Other'),
    ]
    user                  = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consulting_records')
    patient               = models.ForeignKey('Patient', on_delete=models.CASCADE, related_name='consulting_records')
    doctor_name           = models.CharField(max_length=100)
    specialty             = models.CharField(max_length=100, blank=True)
    hospital              = models.CharField(max_length=150, blank=True)
    consultation_date     = models.DateField()
    next_appointment_date = models.DateField(null=True, blank=True)
    fee                   = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    payment_method        = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default='cash')
    notes                 = models.TextField(blank=True)
    instructions          = models.TextField(blank=True)
    created_at            = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-consultation_date']

    def __str__(self):
        return f"{self.patient.name} — Dr. {self.doctor_name} on {self.consultation_date}"


# ── Health Expenses ───────────────────────────────────────────────────────────

class HealthExpense(models.Model):
    EXPENSE_TYPE_CHOICES = [
        ('medicine', 'Medicine Purchase'), ('consulting', 'Consulting Fee'),
        ('lab', 'Lab Test'), ('scan', 'Scan/Imaging'), ('other', 'Other'),
    ]
    PAYMENT_CHOICES = [
        ('cash', 'Cash'), ('card', 'Card'), ('upi', 'UPI'),
        ('insurance', 'Insurance'), ('other', 'Other'),
    ]
    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='health_expenses')
    patient        = models.ForeignKey('Patient', on_delete=models.SET_NULL, null=True, blank=True, related_name='health_expenses')
    expense_type   = models.CharField(max_length=12, choices=EXPENSE_TYPE_CHOICES)
    description    = models.CharField(max_length=200)
    expense_date   = models.DateField()
    amount         = models.DecimalField(max_digits=10, decimal_places=2)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default='cash')
    paid_by        = models.CharField(max_length=100, blank=True)   # e.g. Self, Mom, Insurance
    reference_id   = models.IntegerField(null=True, blank=True)
    notes          = models.CharField(max_length=200, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-expense_date', '-created_at']

    def __str__(self):
        return f"{self.expense_type} — ₹{self.amount} on {self.expense_date}"


# ── Vital Readings ────────────────────────────────────────────────────────────

class VitalReading(models.Model):
    SUGAR_TYPE_CHOICES = [
        ('fasting', 'Fasting'), ('post_meal', 'Post Meal (2hr)'),
        ('random', 'Random'), ('hba1c', 'HbA1c'),
    ]
    SUGAR_UNIT_CHOICES = [('mg_dl', 'mg/dL'), ('mmol_l', 'mmol/L')]
    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vital_readings')
    patient      = models.ForeignKey('Patient', on_delete=models.CASCADE, related_name='vital_readings')
    recorded_at  = models.DateTimeField()
    systolic     = models.IntegerField(null=True, blank=True)
    diastolic    = models.IntegerField(null=True, blank=True)
    pulse        = models.IntegerField(null=True, blank=True)
    blood_sugar  = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    sugar_unit   = models.CharField(max_length=6, choices=SUGAR_UNIT_CHOICES, default='mg_dl', blank=True)
    sugar_type   = models.CharField(max_length=10, choices=SUGAR_TYPE_CHOICES, blank=True)
    food_time    = models.TimeField(null=True, blank=True)
    notes        = models.CharField(max_length=200, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-recorded_at']

    def __str__(self):
        return f"{self.patient.name} vitals @ {self.recorded_at}"
