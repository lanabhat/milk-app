from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('purchase', '0006_lpgconfig_cylinders'),
    ]

    operations = [
        migrations.AddField(
            model_name='lpgbooking',
            name='price',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True),
        ),
    ]
