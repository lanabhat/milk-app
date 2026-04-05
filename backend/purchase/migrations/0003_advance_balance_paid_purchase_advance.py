from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('purchase', '0002_billingsession'),
    ]

    operations = [
        migrations.AddField(
            model_name='advance',
            name='balance_paid',
            field=models.FloatField(default=0),
        ),
        migrations.AddField(
            model_name='purchase',
            name='advance',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='linked_purchases',
                to='purchase.advance'
            ),
        ),
    ]
