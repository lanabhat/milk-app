#!/usr/bin/env python
"""
Helper script to create users from the command line.
Usage: python create_users.py

Edit users_to_create below, run once, then clear the list.
Do NOT commit with real emails or passwords.
"""
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'milk_management.settings')
django.setup()

from django.contrib.auth.models import User

# Populate temporarily, run, then clear.
users_to_create = []

for u in users_to_create:
    obj = User.objects.filter(username=u['email']).first()
    if obj:
        obj.set_password(u['password'])
        obj.first_name = u.get('first_name', '')
        obj.last_name  = u.get('last_name', '')
        obj.save()
        print(f"Updated: {u['email']}")
    else:
        User.objects.create_user(
            username=u['email'], email=u['email'], password=u['password'],
            first_name=u.get('first_name',''), last_name=u.get('last_name',''),
        )
        print(f"Created: {u['email']}")
print("Done.")
