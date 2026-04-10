from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('purchase', '0005_lpg'),
    ]

    operations = [
        # LpgConfig — cylinder stock fields
        migrations.AddField(
            model_name='lpgconfig',
            name='total_cylinders',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='lpgconfig',
            name='filled_cylinders',
            field=models.PositiveIntegerField(default=1),
        ),
        migrations.AddField(
            model_name='lpgconfig',
            name='empty_cylinders',
            field=models.PositiveIntegerField(default=0),
        ),
        # LpgBooking — price field
        migrations.AddField(
            model_name='lpgbooking',
            name='price',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
    ]
