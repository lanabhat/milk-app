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
    visible  = models.BooleanField(default=True)
    position = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.price} Rs per {self.unit}"

    class Meta:
        ordering = ['position', 'name']


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

class ReminderSkip(models.Model):
    """Records dates the user explicitly chose to skip the purchase reminder."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='reminder_skips')
    date = models.DateField()

    class Meta:
        unique_together = ('user', 'date')
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.email} — skipped {self.date}"


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


# ── Vehicle Fleet Management ──────────────────────────────────────────────────

class Vehicle(models.Model):
    FUEL_CHOICES = [
        ('petrol', 'Petrol'), ('diesel', 'Diesel'), ('cng', 'CNG'),
        ('electric', 'Electric'), ('hybrid', 'Hybrid'),
    ]
    TYPE_CHOICES = [
        ('car', 'Car'), ('bike', 'Bike'), ('scooter', 'Scooter'),
        ('truck', 'Truck'), ('other', 'Other'),
    ]
    user             = models.ForeignKey(User, on_delete=models.CASCADE, related_name='vehicles')
    make             = models.CharField(max_length=100)
    model            = models.CharField(max_length=100)
    year             = models.PositiveIntegerField(null=True, blank=True)
    registration_no  = models.CharField(max_length=50)
    color            = models.CharField(max_length=50, blank=True)
    vin_number       = models.CharField(max_length=50, blank=True)
    fuel_type        = models.CharField(max_length=20, choices=FUEL_CHOICES, default='petrol')
    vehicle_type     = models.CharField(max_length=20, choices=TYPE_CHOICES, default='car')
    purchase_date    = models.DateField(null=True, blank=True)
    image_url        = models.CharField(max_length=500, blank=True)
    current_odometer = models.FloatField(default=0)
    is_active        = models.BooleanField(default=True)
    notes            = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} — {self.year} {self.make} {self.model} ({self.registration_no})"


class OdometerReading(models.Model):
    vehicle    = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='odometer_readings')
    reading    = models.FloatField()
    date       = models.DateField()
    notes      = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.vehicle} — {self.reading} km on {self.date}"


class FuelLog(models.Model):
    vehicle         = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='fuel_logs')
    date            = models.DateField()
    fuel_amount     = models.FloatField()
    price_per_litre = models.FloatField()
    total_cost      = models.FloatField()
    odometer        = models.FloatField()
    full_tank       = models.BooleanField(default=True)
    fuel_station    = models.CharField(max_length=100, blank=True)
    notes           = models.CharField(max_length=200, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.vehicle} — {self.fuel_amount}L on {self.date}"


class ServiceCenter(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='service_centers')
    name       = models.CharField(max_length=100)
    address    = models.TextField(blank=True)
    phone      = models.CharField(max_length=30, blank=True)
    notes      = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.user.email} — {self.name}"


class ServiceRecord(models.Model):
    TYPE_CHOICES = [
        ('routine', 'Routine Service'), ('repair', 'Repair'),
        ('accidental', 'Accidental'), ('recall', 'Recall'), ('other', 'Other'),
    ]
    vehicle           = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='service_records')
    service_center    = models.ForeignKey(ServiceCenter, on_delete=models.SET_NULL, null=True, blank=True, related_name='service_records')
    date              = models.DateField()
    service_type      = models.CharField(max_length=20, choices=TYPE_CHOICES, default='routine')
    odometer          = models.FloatField(null=True, blank=True)
    description       = models.TextField(blank=True)
    labour_cost       = models.FloatField(default=0)
    parts_cost        = models.FloatField(default=0)
    total_cost        = models.FloatField(default=0)
    next_service_date = models.DateField(null=True, blank=True)
    next_service_km   = models.FloatField(null=True, blank=True)
    notes             = models.TextField(blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.vehicle} — {self.service_type} on {self.date}"


class ServicePart(models.Model):
    service_record = models.ForeignKey(ServiceRecord, on_delete=models.CASCADE, related_name='parts')
    part_name      = models.CharField(max_length=100)
    part_number    = models.CharField(max_length=50, blank=True)
    manufacturer   = models.CharField(max_length=100, blank=True)
    quantity       = models.FloatField(default=1)
    unit_cost      = models.FloatField()
    total_cost     = models.FloatField()

    def __str__(self):
        return f"{self.part_name} × {self.quantity} @ ₹{self.unit_cost}"


class PuccRecord(models.Model):
    vehicle        = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='pucc_records')
    issue_date     = models.DateField()
    expiry_date    = models.DateField()
    certificate_no = models.CharField(max_length=50, blank=True)
    test_center    = models.CharField(max_length=100, blank=True)
    cost           = models.FloatField(default=0)
    notes          = models.CharField(max_length=200, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-expiry_date']

    def __str__(self):
        return f"{self.vehicle} PUCC — expires {self.expiry_date}"


class InsurancePolicy(models.Model):
    TYPE_CHOICES = [
        ('comprehensive', 'Comprehensive'), ('third_party', 'Third Party'),
        ('own_damage', 'Own Damage'),
    ]
    vehicle       = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='insurance_policies')
    provider      = models.CharField(max_length=100)
    policy_number = models.CharField(max_length=100)
    policy_type   = models.CharField(max_length=20, choices=TYPE_CHOICES, default='comprehensive')
    start_date    = models.DateField()
    end_date      = models.DateField()
    premium       = models.FloatField()
    insured_value = models.FloatField(null=True, blank=True)
    agent_name    = models.CharField(max_length=100, blank=True)
    agent_phone   = models.CharField(max_length=30, blank=True)
    notes         = models.TextField(blank=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-end_date']

    def __str__(self):
        return f"{self.vehicle} — {self.provider} ({self.policy_number})"


class InsuranceClaim(models.Model):
    STATUS_CHOICES = [
        ('filed', 'Filed'), ('under_review', 'Under Review'),
        ('approved', 'Approved'), ('rejected', 'Rejected'), ('settled', 'Settled'),
    ]
    policy          = models.ForeignKey(InsurancePolicy, on_delete=models.CASCADE, related_name='claims')
    vehicle         = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='insurance_claims')
    claim_date      = models.DateField()
    incident_date   = models.DateField()
    description     = models.TextField()
    claimed_amount  = models.FloatField()
    approved_amount = models.FloatField(null=True, blank=True)
    settlement_date = models.DateField(null=True, blank=True)
    status          = models.CharField(max_length=20, choices=STATUS_CHOICES, default='filed')
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-claim_date']

    def __str__(self):
        return f"{self.vehicle} claim ₹{self.claimed_amount} — {self.status}"


class TyrePressureLog(models.Model):
    vehicle     = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='tyre_pressure_logs')
    date        = models.DateField()
    front_left  = models.FloatField(null=True, blank=True)
    front_right = models.FloatField(null=True, blank=True)
    rear_left   = models.FloatField(null=True, blank=True)
    rear_right  = models.FloatField(null=True, blank=True)
    spare       = models.FloatField(null=True, blank=True)
    notes       = models.CharField(max_length=200, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.vehicle} — tyre pressure on {self.date}"


class OilChangeLog(models.Model):
    vehicle          = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='oil_changes')
    date             = models.DateField()
    odometer         = models.FloatField()
    oil_brand        = models.CharField(max_length=100, blank=True)
    oil_grade        = models.CharField(max_length=50, blank=True)
    oil_amount       = models.FloatField(null=True, blank=True)
    cost             = models.FloatField(default=0)
    next_change_date = models.DateField(null=True, blank=True)
    next_change_km   = models.FloatField(null=True, blank=True)
    notes            = models.CharField(max_length=200, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.vehicle} — oil change on {self.date}"


class AccessorySpend(models.Model):
    CAT_CHOICES = [
        ('electrical', 'Electrical'), ('mechanical', 'Mechanical'),
        ('cosmetic', 'Cosmetic'), ('safety', 'Safety'), ('other', 'Other'),
    ]
    vehicle   = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='accessory_spends')
    date      = models.DateField()
    item_name = models.CharField(max_length=100)
    category  = models.CharField(max_length=20, choices=CAT_CHOICES, default='other')
    cost      = models.FloatField()
    vendor    = models.CharField(max_length=100, blank=True)
    notes     = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.vehicle} — {self.item_name} ₹{self.cost}"


class TripLog(models.Model):
    vehicle        = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='trips')
    trip_date      = models.DateField()
    title          = models.CharField(max_length=100)
    from_location  = models.CharField(max_length=100, blank=True)
    to_location    = models.CharField(max_length=100, blank=True)
    start_odometer = models.FloatField(null=True, blank=True)
    end_odometer   = models.FloatField(null=True, blank=True)
    distance_km    = models.FloatField(null=True, blank=True)
    purpose        = models.CharField(max_length=100, blank=True)
    image_url      = models.CharField(max_length=500, blank=True)
    notes          = models.TextField(blank=True)
    is_draft       = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-trip_date', '-created_at']

    def __str__(self):
        return f"{self.vehicle} — {self.title} on {self.trip_date}"


class ExtendedWarranty(models.Model):
    vehicle              = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='extended_warranties')
    provider             = models.CharField(max_length=100)
    contract_number      = models.CharField(max_length=100, blank=True)
    start_date           = models.DateField()
    end_date             = models.DateField()
    coverage_description = models.TextField(blank=True)
    max_claim_amount     = models.FloatField(null=True, blank=True)
    contact_phone        = models.CharField(max_length=30, blank=True)
    cost                 = models.FloatField(default=0)
    notes                = models.TextField(blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-end_date']

    def __str__(self):
        return f"{self.vehicle} — warranty by {self.provider} until {self.end_date}"


class PartReplacement(models.Model):
    vehicle      = models.ForeignKey(Vehicle, on_delete=models.CASCADE, related_name='part_replacements')
    date         = models.DateField()
    part_name    = models.CharField(max_length=100)
    part_number  = models.CharField(max_length=50, blank=True)
    manufacturer = models.CharField(max_length=100, blank=True)
    cost         = models.FloatField()
    vendor       = models.CharField(max_length=100, blank=True)
    odometer     = models.FloatField(null=True, blank=True)
    notes        = models.CharField(max_length=200, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.vehicle} — {self.part_name} replaced on {self.date}"


# ── Journal: Family, Todos & Diary ───────────────────────────────────────────

class FamilyMember(models.Model):
    RELATION_CHOICES = [
        ('self', 'Self/Me'), ('spouse', 'Spouse'), ('son', 'Son'),
        ('daughter', 'Daughter'), ('father', 'Father'), ('mother', 'Mother'),
        ('sibling', 'Sibling'), ('uncle', 'Uncle'), ('aunt', 'Aunt'),
        ('friend', 'Friend'), ('colleague', 'Colleague'), ('other', 'Other'),
    ]
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='family_members')
    name       = models.CharField(max_length=100)
    relation   = models.CharField(max_length=20, choices=RELATION_CHOICES, default='other')
    avatar     = models.CharField(max_length=10, blank=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['relation', 'name']

    def __str__(self):
        return f"{self.user.email} — {self.name} ({self.relation})"


class DiaryEntry(models.Model):
    TYPE_CHOICES     = [('note', 'Note/Diary'), ('todo', 'Todo')]
    PRIORITY_CHOICES = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High')]
    CRITICAL_CHOICES = [('minor', 'Minor'), ('normal', 'Normal'), ('critical', 'Critical')]
    STATUS_CHOICES   = [('open', 'Open'), ('in_progress', 'In Progress'), ('done', 'Done'), ('cancelled', 'Cancelled')]

    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='diary_entries')
    entry_type   = models.CharField(max_length=10, choices=TYPE_CHOICES, default='note')
    title        = models.CharField(max_length=300)
    content      = models.TextField(blank=True)
    owner        = models.ForeignKey(FamilyMember, on_delete=models.SET_NULL, null=True, blank=True, related_name='owned_entries')

    priority     = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium', blank=True)
    criticality  = models.CharField(max_length=10, choices=CRITICAL_CHOICES, default='normal', blank=True)
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    due_date     = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    related_trip = models.ForeignKey('TripLog', on_delete=models.SET_NULL, null=True, blank=True, related_name='diary_entries')
    tags         = models.CharField(max_length=200, blank=True)

    entry_date   = models.DateField()
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-entry_date', '-created_at']

    def __str__(self):
        return f"{self.user.email} — [{self.entry_type}] {self.title}"


class EntryNote(models.Model):
    """Follow-up note / comment on a diary entry or todo."""
    entry      = models.ForeignKey(DiaryEntry, on_delete=models.CASCADE, related_name='notes')
    content    = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"Note on '{self.entry.title}'"


class EntryExpense(models.Model):
    PAYMENT_CHOICES = [('cash', 'Cash'), ('card', 'Card'), ('upi', 'UPI'), ('other', 'Other')]
    entry          = models.ForeignKey(DiaryEntry, on_delete=models.CASCADE, related_name='expenses')
    description    = models.CharField(max_length=200)
    amount         = models.FloatField()
    date           = models.DateField()
    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default='cash')
    paid_by        = models.ForeignKey(FamilyMember, on_delete=models.SET_NULL, null=True, blank=True)
    notes          = models.CharField(max_length=200, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"₹{self.amount} — {self.description}"


# ── Home Management ───────────────────────────────────────────────────────────

class HomeAppliance(models.Model):
    CATEGORY_CHOICES = [
        ('kitchen', 'Kitchen'), ('laundry', 'Laundry'), ('entertainment', 'Entertainment'),
        ('climate', 'Air/Climate'), ('computing', 'Computing'), ('mobile', 'Mobile/Phone'),
        ('lighting', 'Lighting'), ('security', 'Security'), ('other', 'Other'),
    ]
    user            = models.ForeignKey(User, on_delete=models.CASCADE, related_name='home_appliances')
    name            = models.CharField(max_length=200)
    brand           = models.CharField(max_length=100, blank=True)
    model_number    = models.CharField(max_length=100, blank=True)
    category        = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='other')
    purchase_date   = models.DateField(null=True, blank=True)
    purchase_price  = models.FloatField(null=True, blank=True)
    warranty_expiry = models.DateField(null=True, blank=True)
    amc_expiry      = models.DateField(null=True, blank=True)
    serial_number   = models.CharField(max_length=100, blank=True)
    location        = models.CharField(max_length=100, blank=True)
    image_url       = models.CharField(max_length=500, blank=True)
    notes           = models.TextField(blank=True)
    is_active       = models.BooleanField(default=True)
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} — {self.name}"


class ApplianceService(models.Model):
    TYPE_CHOICES = [
        ('routine', 'Routine'), ('repair', 'Repair'), ('amc', 'AMC Service'),
        ('installation', 'Installation'), ('other', 'Other'),
    ]
    appliance         = models.ForeignKey(HomeAppliance, on_delete=models.CASCADE, related_name='services')
    date              = models.DateField()
    service_type      = models.CharField(max_length=20, choices=TYPE_CHOICES, default='routine')
    description       = models.TextField(blank=True)
    technician        = models.CharField(max_length=100, blank=True)
    company           = models.CharField(max_length=100, blank=True)
    cost              = models.FloatField(default=0)
    next_service_date = models.DateField(null=True, blank=True)
    bill_url          = models.CharField(max_length=500, blank=True)
    notes             = models.TextField(blank=True)
    created_at        = models.DateTimeField(auto_now_add=True)
    updated_at        = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']

    def __str__(self):
        return f"{self.appliance.name} — {self.service_type} on {self.date}"


class ElectricityBill(models.Model):
    user            = models.ForeignKey(User, on_delete=models.CASCADE, related_name='electricity_bills')
    bill_date       = models.DateField()
    from_date       = models.DateField()
    to_date         = models.DateField()
    units_consumed  = models.FloatField()
    amount          = models.FloatField()
    opening_reading = models.FloatField(null=True, blank=True)
    closing_reading = models.FloatField(null=True, blank=True)
    meter_number    = models.CharField(max_length=50, blank=True)
    paid            = models.BooleanField(default=False)
    paid_date       = models.DateField(null=True, blank=True)
    notes           = models.CharField(max_length=200, blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-bill_date']

    def __str__(self):
        return f"{self.user.email} — ₹{self.amount} bill on {self.bill_date}"


class SpendCategory(models.Model):
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='spend_categories')
    name       = models.CharField(max_length=100)
    icon       = models.CharField(max_length=10, blank=True)
    color      = models.CharField(max_length=7, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ('user', 'name')

    def __str__(self):
        return f"{self.user.email} — {self.name}"


class HomeSpend(models.Model):
    PAYMENT_CHOICES = [('cash','Cash'),('card','Card'),('upi','UPI'),('bank','Bank Transfer'),('other','Other')]
    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='home_spends')
    date           = models.DateField()
    category       = models.ForeignKey(SpendCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name='spends')
    description    = models.CharField(max_length=300)
    amount         = models.FloatField()
    store_name     = models.CharField(max_length=100, blank=True)
    paid_by        = models.ForeignKey(FamilyMember, on_delete=models.SET_NULL, null=True, blank=True, related_name='home_spends')
    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default='cash')
    notes          = models.CharField(max_length=200, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        return f"{self.user.email} — ₹{self.amount} ({self.description})"


class EducationExpense(models.Model):
    CATEGORY_CHOICES = [
        ('tuition', 'Tuition/School Fee'), ('transport', 'Transport'),
        ('food', 'Food/Tiffin'), ('books', 'Books/Stationery'),
        ('uniform', 'Uniform/Shoes'), ('activity', 'Activity/Sports'),
        ('exam', 'Exam/Test Fee'), ('coaching', 'Coaching/Tuition Class'),
        ('other', 'Other'),
    ]
    PAYMENT_CHOICES = [('cash','Cash'),('card','Card'),('upi','UPI'),('bank','Bank Transfer'),('other','Other')]
    user           = models.ForeignKey(User, on_delete=models.CASCADE, related_name='education_expenses')
    family_member  = models.ForeignKey(FamilyMember, on_delete=models.SET_NULL, null=True, blank=True, related_name='education_expenses')
    date           = models.DateField()
    category       = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='tuition')
    description    = models.CharField(max_length=200)
    amount         = models.FloatField()
    institution    = models.CharField(max_length=150, blank=True)
    academic_year  = models.CharField(max_length=20, blank=True)
    payment_method = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default='cash')
    notes          = models.CharField(max_length=200, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        name = self.family_member.name if self.family_member else 'unknown'
        return f"{name} — {self.category} ₹{self.amount}"


# ── Lending / IOU Tracker ─────────────────────────────────────────────────────

class LendingLog(models.Model):
    user         = models.ForeignKey(User, on_delete=models.CASCADE, related_name='lendings')
    contact      = models.ForeignKey(FamilyMember, on_delete=models.SET_NULL, null=True, blank=True, related_name='lendings')
    contact_name = models.CharField(max_length=100, blank=True)  # free-text fallback
    date         = models.DateField()
    description  = models.CharField(max_length=300)
    amount       = models.FloatField()
    notes        = models.CharField(max_length=200, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date', '-created_at']

    def __str__(self):
        name = self.contact.name if self.contact else self.contact_name or 'Unknown'
        return f"{self.user.email} lent ₹{self.amount} to {name} on {self.date}"


class PaybackLog(models.Model):
    lending    = models.ForeignKey(LendingLog, on_delete=models.CASCADE, related_name='paybacks')
    date       = models.DateField()
    amount     = models.FloatField()
    notes      = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date']

    def __str__(self):
        return f"Payback ₹{self.amount} for lending #{self.lending_id} on {self.date}"
