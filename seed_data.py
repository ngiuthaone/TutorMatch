#!/usr/bin/env python3
"""
Seeding script for Tutoria database with Vietnamese locale.
Generates SQL INSERT statements in correct FK order.
"""

import uuid
import random
from datetime import datetime, timedelta
from faker import Faker

fake = Faker('vi_VN')
random.seed(42)
fake.seed_instance(42)

# Configuration
NUM_TUTORS = 5
NUM_LEARNERS = 10
NUM_ADMINS = 1
NUM_TUTOR_PROFILES = 20
NUM_OFFERINGS = 30
NUM_SESSIONS = 50
NUM_BOOKINGS = 100
NUM_PAYMENTS = 30
NUM_REFUNDS = 10
NUM_REVIEWS = 50
NUM_NOTIFICATIONS = 100
NUM_TUTOR_VIEWS = 200

VND_RATES = [100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 700000, 800000, 900000, 1000000]
VIETNAMESE_SUBJECTS = [
    "Toán học", "Vật lý", "Hóa học", "Sinh học", "Tiếng Anh", "Tiếng Việt",
    "Lịch sử", "Địa lý", "GDCD", "Tin học", "Khoa học", "Kỹ năng sống",
    "Lập trình", "Thiết kế", "Âm nhạc", "Mỹ thuật", "Thể dục", "Ngoại ngữ"
]
VIETNAMESE_DISTRICTS = [
    "Quận 1", "Quận 2", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7",
    "Quận 8", "Quận 9", "Quận 10", "Quận 11", "Quận 12", "Bình Thạnh",
    "Phú Nhuận", "Gò Vấp", "Tân Bình", "Tân Phú", "Bình Tân", "Hóc Môn",
    "Củ Chi", "Nhà Bè", "Cần Giờ", "Thủ Đức"
]

# Storage for generated IDs
profiles = []
tutor_profiles = []
offerings = []
sessions = []
bookings = []
payments = []
refunds = []
reviews = []
notifications = []
tutor_views = []

def gen_uuid():
    return str(uuid.uuid4())

def random_datetime(start_days_ago=30, end_days_ahead=60):
    start = datetime.now() - timedelta(days=start_days_ago)
    end = datetime.now() + timedelta(days=end_days_ahead)
    return fake.date_time_between(start_date=start, end_date=end)

def random_past_datetime(days_ago=30):
    return fake.date_time_between(start_date=f'-{days_ago}d', end_date='now')

def sql_escape(s):
    if s is None:
        return 'NULL'
    return "'" + str(s).replace("'", "''") + "'"

def sql_bool(b):
    return 'true' if b else 'false'

def write_sql(file, table, columns, values_list):
    """Write INSERT statement for multiple rows."""
    cols = ', '.join(columns)
    rows = []
    for vals in values_list:
        rows.append('(' + ', '.join(vals) + ')')
    sql = f"INSERT INTO {table} ({cols}) VALUES\n" + ',\n'.join(rows) + ';\n\n'
    file.write(sql)
    return len(values_list)

# Generate data
print("Generating profiles...")
# 1. PROFILES - 5 tutors + 10 learners + 1 admin = 16
for i in range(NUM_TUTORS):
    pid = gen_uuid()
    profiles.append({
        'id': pid,
        'email': fake.unique.email(),
        'name': fake.name(),
        'role': 'tutor',
        'phone': fake.phone_number(),
        'avatar_url': fake.image_url(width=200, height=200),
        'created_at': random_past_datetime(60).isoformat(),
        'updated_at': random_past_datetime(30).isoformat()
    })

for i in range(NUM_LEARNERS):
    pid = gen_uuid()
    profiles.append({
        'id': pid,
        'email': fake.unique.email(),
        'name': fake.name(),
        'role': 'learner',
        'phone': fake.phone_number(),
        'avatar_url': fake.image_url(width=200, height=200),
        'created_at': random_past_datetime(60).isoformat(),
        'updated_at': random_past_datetime(30).isoformat()
    })

for i in range(NUM_ADMINS):
    pid = gen_uuid()
    profiles.append({
        'id': pid,
        'email': fake.unique.email(),
        'name': fake.name(),
        'role': 'admin',
        'phone': fake.phone_number(),
        'avatar_url': fake.image_url(width=200, height=200),
        'created_at': random_past_datetime(60).isoformat(),
        'updated_at': random_past_datetime(30).isoformat()
    })

tutor_ids = [p['id'] for p in profiles if p['role'] == 'tutor']
learner_ids = [p['id'] for p in profiles if p['role'] == 'learner']
admin_ids = [p['id'] for p in profiles if p['role'] == 'admin']
all_user_ids = [p['id'] for p in profiles]

print("Generating tutor_profiles...")
# 2. TUTOR_PROFILES - 20 profiles (some tutors may have multiple)
teaching_formats = ['online', 'offline', 'both']
currencies = ['VND']
publication_statuses = ['published', 'draft', 'archived']
verification_statuses = ['pending', 'verified', 'rejected']

for i in range(NUM_TUTOR_PROFILES):
    tp_id = gen_uuid()
    user_id = random.choice(tutor_ids)
    tutor_profiles.append({
        'id': tp_id,
        'user_id': user_id,
        'display_name': fake.name(),
        'headline': fake.sentence(nb_words=6),
        'bio': fake.paragraph(nb_sentences=3),
        'hourly_rate_vnd': random.choice(VND_RATES),
        'currency': 'VND',
        'teaching_format': random.choice(teaching_formats),
        'avatar_object_path': f"avatars/{tp_id}.jpg",
        'publication_status': random.choice(publication_statuses),
        'published_at': random_past_datetime(30).isoformat() if random.random() > 0.3 else 'NULL',
        'unpublished_at': 'NULL',
        'version': 1,
        'role': 'tutor',
        'intro_video_object_path': f"videos/{tp_id}.mp4" if random.random() > 0.5 else 'NULL',
        'portfolio_url': fake.url() if random.random() > 0.3 else 'NULL',
        'lesson_description': fake.paragraph(nb_sentences=2),
        'cancel_learner_policy': fake.sentence(nb_words=10),
        'cancel_late_policy': fake.sentence(nb_words=10),
        'no_show_policy': fake.sentence(nb_words=10),
        'booking_notice': random.randint(1, 24),
        'booking_window_days': random.randint(7, 60),
        'lesson_buffer_min': random.choice([0, 15, 30]),
        'same_day_booking': sql_bool(random.random() > 0.5),
        'display_duration_min': random.choice([60, 90, 120]),
        'rates': '{"individual": 200000, "group": 150000}',
        'consultation': sql_bool(random.random() > 0.5),
        'verification_status': random.choice(verification_statuses),
        'search_vector': 'NULL'
    })

tutor_profile_ids = [tp['id'] for tp in tutor_profiles]

print("Generating offerings...")
# 3. OFFERINGS - 30 offerings
offering_kinds = ['course', 'workshop', 'consultation', 'tutoring']
booking_modes = ['instant', 'request', 'schedule']
pricing_models = ['per_session', 'per_hour', 'per_participant', 'package']

for i in range(NUM_OFFERINGS):
    oid = gen_uuid()
    creator_id = random.choice(tutor_ids)
    offerings.append({
        'kind': random.choice(offering_kinds),
        'slug': fake.slug() + f"-{i}",
        'title': fake.sentence(nb_words=4).rstrip('.'),
        'creator_id': creator_id,
        'description': fake.paragraph(nb_sentences=3),
        'unit_price_vnd': random.choice(VND_RATES),
        'currency': 'VND',
        'config': '{"duration_min": 90, "max_students": 10}',
        'publication_status': random.choice(publication_statuses),
        'pricing_model': random.choice(pricing_models),
        'price_per_participant_vnd': random.choice(VND_RATES),
        'hourly_rate_vnd': random.choice(VND_RATES),
        'booking_mode': random.choice(booking_modes),
        'map_url': fake.url() if random.random() > 0.5 else 'NULL',
        'minimum_age': random.randint(6, 18),
        'accessibility_note': fake.sentence(nb_words=8) if random.random() > 0.5 else 'NULL'
    })

offering_ids = [o['id'] for o in offerings]

print("Generating offering_hosts...")
# 4. OFFERING_HOSTS
offering_hosts = []
for offering in offerings:
    # Each offering has 1-2 hosts
    num_hosts = random.randint(1, 2)
    hosts = random.sample(tutor_ids, min(num_hosts, len(tutor_ids)))
    for host_id in hosts:
        offering_hosts.append({
            'offering_id': offering['id'],
            'user_id': host_id,
            'capability': random.choice(['teach', 'assist', 'manage']),
            'granted_by': offering['creator_id']
        })

print("Generating sessions...")
# 5. SESSIONS - 50 sessions
session_statuses = ['scheduled', 'completed', 'cancelled', 'in_progress']

for i in range(NUM_SESSIONS):
    sid = gen_uuid()
    offering = random.choice(offerings)
    host_id = random.choice(tutor_ids)
    starts_at = random_datetime(0, 30)
    ends_at = starts_at + timedelta(minutes=random.choice([60, 90, 120, 180]))
    sessions.append({
        'id': sid,
        'offering_id': offering['id'],
        'host_id': host_id,
        'starts_at': starts_at.isoformat(),
        'ends_at': ends_at.isoformat(),
        'status': random.choice(session_statuses),
        'min_participants': random.randint(1, 3),
        'max_participants': random.randint(5, 20),
        'version': 1,
        'meeting_url': fake.url() if random.random() > 0.3 else 'NULL',
        'meeting_id': fake.uuid4() if random.random() > 0.3 else 'NULL'
    })

session_ids = [s['id'] for s in sessions]

print("Generating bookings...")
# 6. BOOKINGS - 100 bookings
booking_statuses = ['confirmed', 'pending', 'cancelled', 'completed', 'no_show']

for i in range(NUM_BOOKINGS):
    bid = gen_uuid()
    session = random.choice(sessions)
    learner_id = random.choice(learner_ids)
    participant_count = random.randint(1, 3)
    hourly_rate = random.choice(VND_RATES)
    duration = random.choice([60, 90, 120])
    pricing_model = random.choice(pricing_models)
    
    if pricing_model == 'per_session':
        amount = hourly_rate
    elif pricing_model == 'per_hour':
        amount = hourly_rate * (duration / 60)
    elif pricing_model == 'per_participant':
        amount = hourly_rate * participant_count
    else:
        amount = hourly_rate * 4  # package
    
    bookings.append({
        'id': bid,
        'session_id': session['id'],
        'learner_id': learner_id,
        'participant_count': participant_count,
        'status': random.choice(booking_statuses),
        'pricing_amount_vnd': int(amount),
        'pricing_currency': 'VND',
        'pricing_hourly_rate_vnd': hourly_rate,
        'pricing_duration_minutes': duration,
        'pricing_model': pricing_model,
        'pricing_snapshotted_at': random_past_datetime(10).isoformat(),
        'pricing_unit_price_vnd': hourly_rate,
        'pricing_participant_count': participant_count,
        'idempotency_key': fake.uuid4(),
        'learner_name': fake.name(),
        'learner_email': fake.email(),
        'learner_phone': fake.phone_number(),
        'learner_note': fake.sentence(nb_words=8) if random.random() > 0.5 else 'NULL'
    })

booking_ids = [b['id'] for b in bookings]

print("Generating payments...")
# 7. PAYMENTS - 30 payments
payment_providers = ['vnpay', 'momo', 'zalopay', 'stripe', 'bank_transfer']
payment_statuses = ['pending', 'completed', 'failed', 'refunded']

for i in range(NUM_PAYMENTS):
    pid = gen_uuid()
    booking = random.choice(bookings)
    payments.append({
        'id': pid,
        'booking_id': booking['id'],
        'provider': random.choice(payment_providers),
        'status': random.choice(payment_statuses),
        'amount_vnd': booking['pricing_amount_vnd'],
        'currency': 'VND',
        'refunded_amount_vnd': 0
    })

payment_ids = [p['id'] for p in payments]

print("Generating refunds...")
# 8. REFUNDS - 10 refunds
refund_kinds = ['full', 'partial', 'cancel_fee']
refund_statuses = ['pending', 'processing', 'completed', 'rejected']

for i in range(NUM_REFUNDS):
    rid = gen_uuid()
    payment = random.choice(payments)
    amount = random.randint(10000, payment['amount_vnd'])
    refunds.append({
        'id': rid,
        'payment_id': payment['id'],
        'kind': random.choice(refund_kinds),
        'status': random.choice(refund_statuses),
        'amount_vnd': amount,
        'idempotency_key': fake.uuid4(),
        'provider_request_id': fake.uuid4(),
        'provider_transaction_no': fake.bothify(text='TXN-########'),
        'reason': fake.sentence(nb_words=6)
    })

print("Generating tutor_reviews...")
# 9. TUTOR_REVIEWS - 50 reviews
review_statuses = ['published', 'pending', 'hidden']

for i in range(NUM_REVIEWS):
    tp = random.choice(tutor_profiles)
    booking = random.choice([b for b in bookings if b['status'] == 'completed'])
    reviews.append({
        'id': gen_uuid(),
        'tutor_profile_id': tp['id'],
        'booking_id': booking['id'],
        'learner_id': booking['learner_id'],
        'rating': random.randint(1, 5),
        'body': fake.paragraph(nb_sentences=2),
        'status': random.choice(review_statuses)
    })

print("Generating notifications...")
# 10. NOTIFICATIONS - 100 notifications
notification_events = ['booking_confirmed', 'session_reminder', 'payment_received', 'review_received', 'session_cancelled', 'new_message']

for i in range(NUM_NOTIFICATIONS):
    notifications.append({
        'id': gen_uuid(),
        'user_id': random.choice(all_user_ids),
        'event': random.choice(notification_events),
        'title': fake.sentence(nb_words=4).rstrip('.'),
        'body': fake.sentence(nb_words=10),
        'href': fake.url() if random.random() > 0.5 else 'NULL',
        'read_at': random_past_datetime(5).isoformat() if random.random() > 0.3 else 'NULL',
        'created_at': random_past_datetime(30).isoformat()
    })

print("Generating tutor_views...")
# 11. TUTOR_VIEWS - 200 views
for i in range(NUM_TUTOR_VIEWS):
    tutor_views.append({
        'id': gen_uuid(),
        'tutor_profile_id': random.choice(tutor_profile_ids),
        'viewer_id': random.choice(all_user_ids),
        'created_at': random_past_datetime(30).isoformat()
    })

# Write SQL file
print("Writing SQL file...")
with open('/Users/soshi/Documents/tutormatch/seed_data.sql', 'w') as f:
    f.write("-- Seed data for Tutoria database\n")
    f.write("-- Generated with Vietnamese locale (vi_VN)\n")
    f.write(f"-- Timestamp: {datetime.now().isoformat()}\n\n")
    
    total_statements = 0
    
    # 1. profiles
    cols = ['id', 'email', 'name', 'role', 'phone', 'avatar_url', 'created_at', 'updated_at']
    vals = []
    for p in profiles:
        vals.append([
            sql_escape(p['id']),
            sql_escape(p['email']),
            sql_escape(p['name']),
            sql_escape(p['role']),
            sql_escape(p['phone']),
            sql_escape(p['avatar_url']),
            sql_escape(p['created_at']),
            sql_escape(p['updated_at'])
        ])
    total_statements += write_sql(f, 'profiles', cols, vals)
    
    # 2. tutor_profiles
    cols = ['id', 'user_id', 'display_name', 'headline', 'bio', 'hourly_rate_vnd', 'currency',
            'teaching_format', 'avatar_object_path', 'publication_status', 'published_at',
            'unpublished_at', 'version', 'role', 'intro_video_object_path', 'portfolio_url',
            'lesson_description', 'cancel_learner_policy', 'cancel_late_policy', 'no_show_policy',
            'booking_notice', 'booking_window_days', 'lesson_buffer_min', 'same_day_booking',
            'display_duration_min', 'rates', 'consultation', 'verification_status', 'search_vector']
    vals = []
    for tp in tutor_profiles:
        vals.append([
            sql_escape(tp['id']),
            sql_escape(tp['user_id']),
            sql_escape(tp['display_name']),
            sql_escape(tp['headline']),
            sql_escape(tp['bio']),
            str(tp['hourly_rate_vnd']),
            sql_escape(tp['currency']),
            sql_escape(tp['teaching_format']),
            sql_escape(tp['avatar_object_path']),
            sql_escape(tp['publication_status']),
            sql_escape(tp['published_at']),
            sql_escape(tp['unpublished_at']),
            str(tp['version']),
            sql_escape(tp['role']),
            sql_escape(tp['intro_video_object_path']),
            sql_escape(tp['portfolio_url']),
            sql_escape(tp['lesson_description']),
            sql_escape(tp['cancel_learner_policy']),
            sql_escape(tp['cancel_late_policy']),
            sql_escape(tp['no_show_policy']),
            str(tp['booking_notice']),
            str(tp['booking_window_days']),
            str(tp['lesson_buffer_min']),
            tp['same_day_booking'],
            str(tp['display_duration_min']),
            sql_escape(tp['rates']),
            tp['consultation'],
            sql_escape(tp['verification_status']),
            tp['search_vector']
        ])
    total_statements += write_sql(f, 'tutor_profiles', cols, vals)
    
    # 3. offerings
    cols = ['id', 'kind', 'slug', 'title', 'creator_id', 'description', 'unit_price_vnd',
            'currency', 'config', 'publication_status', 'pricing_model', 'price_per_participant_vnd',
            'hourly_rate_vnd', 'booking_mode', 'map_url', 'minimum_age', 'accessibility_note']
    vals = []
    for o in offerings:
        vals.append([
            sql_escape(o['id']),
            sql_escape(o['kind']),
            sql_escape(o['slug']),
            sql_escape(o['title']),
            sql_escape(o['creator_id']),
            sql_escape(o['description']),
            str(o['unit_price_vnd']),
            sql_escape(o['currency']),
            sql_escape(o['config']),
            sql_escape(o['publication_status']),
            sql_escape(o['pricing_model']),
            str(o['price_per_participant_vnd']),
            str(o['hourly_rate_vnd']),
            sql_escape(o['booking_mode']),
            sql_escape(o['map_url']),
            str(o['minimum_age']),
            sql_escape(o['accessibility_note'])
        ])
    total_statements += write_sql(f, 'offerings', cols, vals)
    
    # 4. offering_hosts
    cols = ['offering_id', 'user_id', 'capability', 'granted_by']
    vals = []
    for oh in offering_hosts:
        vals.append([
            sql_escape(oh['offering_id']),
            sql_escape(oh['user_id']),
            sql_escape(oh['capability']),
            sql_escape(oh['granted_by'])
        ])
    total_statements += write_sql(f, 'offering_hosts', cols, vals)
    
    # 5. sessions
    cols = ['id', 'offering_id', 'host_id', 'starts_at', 'ends_at', 'status',
            'min_participants', 'max_participants', 'version', 'meeting_url', 'meeting_id']
    vals = []
    for s in sessions:
        vals.append([
            sql_escape(s['id']),
            sql_escape(s['offering_id']),
            sql_escape(s['host_id']),
            sql_escape(s['starts_at']),
            sql_escape(s['ends_at']),
            sql_escape(s['status']),
            str(s['min_participants']),
            str(s['max_participants']),
            str(s['version']),
            sql_escape(s['meeting_url']),
            sql_escape(s['meeting_id'])
        ])
    total_statements += write_sql(f, 'sessions', cols, vals)
    
    # 6. bookings
    cols = ['id', 'session_id', 'learner_id', 'participant_count', 'status',
            'pricing_amount_vnd', 'pricing_currency', 'pricing_hourly_rate_vnd',
            'pricing_duration_minutes', 'pricing_model', 'pricing_snapshotted_at',
            'pricing_unit_price_vnd', 'pricing_participant_count', 'idempotency_key',
            'learner_name', 'learner_email', 'learner_phone', 'learner_note']
    vals = []
    for b in bookings:
        vals.append([
            sql_escape(b['id']),
            sql_escape(b['session_id']),
            sql_escape(b['learner_id']),
            str(b['participant_count']),
            sql_escape(b['status']),
            str(b['pricing_amount_vnd']),
            sql_escape(b['pricing_currency']),
            str(b['pricing_hourly_rate_vnd']),
            str(b['pricing_duration_minutes']),
            sql_escape(b['pricing_model']),
            sql_escape(b['pricing_snapshotted_at']),
            str(b['pricing_unit_price_vnd']),
            str(b['pricing_participant_count']),
            sql_escape(b['idempotency_key']),
            sql_escape(b['learner_name']),
            sql_escape(b['learner_email']),
            sql_escape(b['learner_phone']),
            sql_escape(b['learner_note'])
        ])
    total_statements += write_sql(f, 'bookings', cols, vals)
    
    # 7. payments
    cols = ['id', 'booking_id', 'provider', 'status', 'amount_vnd', 'currency', 'refunded_amount_vnd']
    vals = []
    for p in payments:
        vals.append([
            sql_escape(p['id']),
            sql_escape(p['booking_id']),
            sql_escape(p['provider']),
            sql_escape(p['status']),
            str(p['amount_vnd']),
            sql_escape(p['currency']),
            str(p['refunded_amount_vnd'])
        ])
    total_statements += write_sql(f, 'payments', cols, vals)
    
    # 8. refunds
    cols = ['id', 'payment_id', 'kind', 'status', 'amount_vnd', 'idempotency_key',
            'provider_request_id', 'provider_transaction_no', 'reason']
    vals = []
    for r in refunds:
        vals.append([
            sql_escape(r['id']),
            sql_escape(r['payment_id']),
            sql_escape(r['kind']),
            sql_escape(r['status']),
            str(r['amount_vnd']),
            sql_escape(r['idempotency_key']),
            sql_escape(r['provider_request_id']),
            sql_escape(r['provider_transaction_no']),
            sql_escape(r['reason'])
        ])
    total_statements += write_sql(f, 'refunds', cols, vals)
    
    # 9. tutor_reviews
    cols = ['id', 'tutor_profile_id', 'booking_id', 'learner_id', 'rating', 'body', 'status']
    vals = []
    for r in reviews:
        vals.append([
            sql_escape(r['id']),
            sql_escape(r['tutor_profile_id']),
            sql_escape(r['booking_id']),
            sql_escape(r['learner_id']),
            str(r['rating']),
            sql_escape(r['body']),
            sql_escape(r['status'])
        ])
    total_statements += write_sql(f, 'tutor_reviews', cols, vals)
    
    # 10. notifications
    cols = ['id', 'user_id', 'event', 'title', 'body', 'href', 'read_at', 'created_at']
    vals = []
    for n in notifications:
        vals.append([
            sql_escape(n['id']),
            sql_escape(n['user_id']),
            sql_escape(n['event']),
            sql_escape(n['title']),
            sql_escape(n['body']),
            sql_escape(n['href']),
            sql_escape(n['read_at']),
            sql_escape(n['created_at'])
        ])
    total_statements += write_sql(f, 'notifications', cols, vals)
    
    # 11. tutor_views
    cols = ['id', 'tutor_profile_id', 'viewer_id', 'created_at']
    vals = []
    for tv in tutor_views:
        vals.append([
            sql_escape(tv['id']),
            sql_escape(tv['tutor_profile_id']),
            sql_escape(tv['viewer_id']),
            sql_escape(tv['created_at'])
        ])
    total_statements += write_sql(f, 'tutor_views', cols, vals)

print(f"Done! Generated {total_statements} INSERT statements")
print(f"Output: /Users/soshi/Documents/tutormatch/seed_data.sql")
