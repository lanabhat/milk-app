from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('purchase', '0003_advance_balance_paid_purchase_advance'),
    ]

    operations = [
        migrations.AddField(
            model_name='item',
            name='category',
            field=models.CharField(
                blank=True,
                choices=[('milk', 'Milk & Dairy'), ('newspaper', 'Newspaper & Magazine'), ('other', 'Other')],
                default='other',
                max_length=50,
            ),
        ),
        # Set default categories for known items by name
        migrations.RunSQL(
            sql="""
                UPDATE purchase_item SET category = 'milk'
                WHERE name LIKE '%Milk%' OR name LIKE '%milk%' OR name LIKE '%Nandini%';

                UPDATE purchase_item SET category = 'newspaper'
                WHERE name LIKE '%Prabha%' OR name LIKE '%Express%'
                   OR name LIKE '%Times%' OR name LIKE '%Hindu%'
                   OR name LIKE '%Deccan%' OR name LIKE '%Magazine%';
            """,
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
