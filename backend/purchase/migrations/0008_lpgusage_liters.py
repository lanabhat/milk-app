import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('purchase', '0007_lpgbooking_price'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name='lpgconfig',
            name='liters_per_cylinder',
            field=models.FloatField(default=14.2),
        ),
        migrations.CreateModel(
            name='LpgUsage',
            fields=[
                ('id',         models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('start_date', models.DateField()),
                ('end_date',   models.DateField(blank=True, null=True)),
                ('price',      models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ('notes',      models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user',       models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lpg_usages', to=settings.AUTH_USER_MODEL)),
                ('booking',    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='usages', to='purchase.lpgbooking')),
            ],
            options={
                'ordering': ['-start_date', '-created_at'],
            },
        ),
    ]
