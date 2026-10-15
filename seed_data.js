#!/usr/bin/env node
/**
 * Seeding script for Tutoria database with Vietnamese locale.
 * Generates SQL INSERT statements in correct FK order.
 */

const { faker } = require('@faker-js/faker');
const fs = require('fs');
const crypto = require('crypto');

// Set Vietnamese locale
faker.locale = 'vi_VN';

// Configuration
const NUM_TUTORS = 5;
const NUM_LEARNERS = 10;
const NUM_ADMINS = 1;
const NUM_TUTOR_PROFILES = 20;
const NUM_OFFERINGS = 30;
const NUM_SESSIONS = 50;
const NUM_BOOKINGS = 100;
const NUM_PAYMENTS = 30;
const NUM_REFUNDS = 10;
const NUM_REVIEWS = 50;
const NUM_NOTIFICATIONS = 100;
const NUM_TUTOR_VIEWS = 200;

const VND_RATES = [100000, 150000, 200000, 250000, 300000, 350000, 400000, 450000, 500000, 600000, 700000, 800000, 900000, 1000000];
const VIETNAMESE_SUBJECTS = [
    "Toán học", "Vật lý", "Hóa học", "Sinh học", "Tiếng Anh", "Tiếng Việt",
    "Lịch sử", "Địa lý", "GDCD", "Tin học", "Khoa học", "Kỹ năng sống",
    "Lập trình", "Thiết kế", "Âm nhạc", "Mỹ thuật", "Thể dục", "Ngoại ngữ"
];
const VIETNAMESE_DISTRICTS = [
    "Quận 1", "Quận 2", "Quận 3", "Quận 4", "Quận 5", "Quận 6", "Quận 7",
    "Quận 8", "Quận 9", "Quận 10", "Quận 11", "Quận 12", "Bình Thạnh",
    "Phú Nhuận", "Gò Vấp", "Tân Bình", "Tân Phú", "Bình Tân", "Hóc Môn",
    "Củ Chi", "Nhà Bè", "Cần Giờ", "Thủ Đức"
];

// Storage for generated IDs
const profiles = [];
const tutorProfiles = [];
const offerings = [];
const sessions = [];
const bookings = [];
const payments = [];
const refunds = [];
const reviews = [];
const notifications = [];
const tutorViews = [];
const offeringHosts = [];

function genUuid() {
    return crypto.randomUUID();
}

function randomDateTime(startDaysAgo = 30, endDaysAhead = 60) {
    const start = new Date();
    start.setDate(start.getDate() - startDaysAgo);
    const end = new Date();
    end.setDate(end.getDate() + endDaysAhead);
    return faker.date.between({ from: start, to: end });
}

function randomPastDateTime(daysAgo = 30) {
    const start = new Date();
    start.setDate(start.getDate() - daysAgo);
    return faker.date.between({ from: start, to: new Date() });
}

function sqlEscape(s) {
    if (s === null || s === undefined || s === 'NULL') {
        return 'NULL';
    }
    return "'" + String(s).replace(/'/g, "''") + "'";
}

function sqlBool(b) {
    return b ? 'true' : 'false';
}

function writeSql(file, table, columns, valuesList) {
    const cols = columns.join(', ');
    const rows = valuesList.map(vals => '(' + vals.join(', ') + ')');
    const sql = `INSERT INTO ${table} (${cols}) VALUES\n` + rows.join(',\n') + ';\n\n';
    file.write(sql);
    return valuesList.length;
}

// Generate data
console.log("Generating profiles...");
// 1. PROFILES - 5 tutors + 10 learners + 1 admin = 16
for (let i = 0; i < NUM_TUTORS; i++) {
    const pid = genUuid();
    profiles.push({
        id: pid,
        email: faker.internet.email(),
        name: faker.person.fullName(),
        role: 'tutor',
        phone: faker.phone.number(),
        avatar_url: faker.image.avatar(),
        created_at: randomPastDateTime(60).toISOString(),
        updated_at: randomPastDateTime(30).toISOString()
    });
}

for (let i = 0; i < NUM_LEARNERS; i++) {
    const pid = genUuid();
    profiles.push({
        id: pid,
        email: faker.internet.email(),
        name: faker.person.fullName(),
        role: 'learner',
        phone: faker.phone.number(),
        avatar_url: faker.image.avatar(),
        created_at: randomPastDateTime(60).toISOString(),
        updated_at: randomPastDateTime(30).toISOString()
    });
}

for (let i = 0; i < NUM_ADMINS; i++) {
    const pid = genUuid();
    profiles.push({
        id: pid,
        email: faker.internet.email(),
        name: faker.person.fullName(),
        role: 'admin',
        phone: faker.phone.number(),
        avatar_url: faker.image.avatar(),
        created_at: randomPastDateTime(60).toISOString(),
        updated_at: randomPastDateTime(30).toISOString()
    });
}

const tutorIds = profiles.filter(p => p.role === 'tutor').map(p => p.id);
const learnerIds = profiles.filter(p => p.role === 'learner').map(p => p.id);
const adminIds = profiles.filter(p => p.role === 'admin').map(p => p.id);
const allUserIds = profiles.map(p => p.id);

console.log("Generating tutor_profiles...");
// 2. TUTOR_PROFILES - 20 profiles
const teachingFormats = ['online', 'offline', 'both'];
const publicationStatuses = ['published', 'draft', 'archived'];
const verificationStatuses = ['pending', 'verified', 'rejected'];

for (let i = 0; i < NUM_TUTOR_PROFILES; i++) {
    const tpId = genUuid();
    const userId = faker.helpers.arrayElement(tutorIds);
    tutorProfiles.push({
        id: tpId,
        user_id: userId,
        display_name: faker.person.fullName(),
        headline: faker.lorem.sentence(6),
        bio: faker.lorem.paragraph(3),
        hourly_rate_vnd: faker.helpers.arrayElement(VND_RATES),
        currency: 'VND',
        teaching_format: faker.helpers.arrayElement(teachingFormats),
        avatar_object_path: `avatars/${tpId}.jpg`,
        publication_status: faker.helpers.arrayElement(publicationStatuses),
        published_at: Math.random() > 0.3 ? randomPastDateTime(30).toISOString() : 'NULL',
        unpublished_at: 'NULL',
        version: 1,
        role: 'tutor',
        intro_video_object_path: Math.random() > 0.5 ? `videos/${tpId}.mp4` : 'NULL',
        portfolio_url: Math.random() > 0.3 ? faker.internet.url() : 'NULL',
        lesson_description: faker.lorem.paragraph(2),
        cancel_learner_policy: faker.lorem.sentence(10),
        cancel_late_policy: faker.lorem.sentence(10),
        no_show_policy: faker.lorem.sentence(10),
        booking_notice: faker.number.int({ min: 1, max: 24 }),
        booking_window_days: faker.number.int({ min: 7, max: 60 }),
        lesson_buffer_min: faker.helpers.arrayElement([0, 15, 30]),
        same_day_booking: sqlBool(Math.random() > 0.5),
        display_duration_min: faker.helpers.arrayElement([60, 90, 120]),
        rates: '{"individual": 200000, "group": 150000}',
        consultation: sqlBool(Math.random() > 0.5),
        verification_status: faker.helpers.arrayElement(verificationStatuses),
        search_vector: 'NULL'
    });
}

const tutorProfileIds = tutorProfiles.map(tp => tp.id);

console.log("Generating offerings...");
// 3. OFFERINGS - 30 offerings
const offeringKinds = ['course', 'workshop', 'consultation', 'tutoring'];
const bookingModes = ['instant', 'request', 'schedule'];
const pricingModels = ['per_session', 'per_hour', 'per_participant', 'package'];

for (let i = 0; i < NUM_OFFERINGS; i++) {
    const oid = genUuid();
    const creatorId = faker.helpers.arrayElement(tutorIds);
    offerings.push({
        id: oid,
        kind: faker.helpers.arrayElement(offeringKinds),
        slug: faker.helpers.slugify(faker.lorem.words(3)) + `-${i}`,
        title: faker.lorem.sentence(4).replace(/\.$/, ''),
        creator_id: creatorId,
        description: faker.lorem.paragraph(3),
        unit_price_vnd: faker.helpers.arrayElement(VND_RATES),
        currency: 'VND',
        config: '{"duration_min": 90, "max_students": 10}',
        publication_status: faker.helpers.arrayElement(publicationStatuses),
        pricing_model: faker.helpers.arrayElement(pricingModels),
        price_per_participant_vnd: faker.helpers.arrayElement(VND_RATES),
        hourly_rate_vnd: faker.helpers.arrayElement(VND_RATES),
        booking_mode: faker.helpers.arrayElement(bookingModes),
        map_url: Math.random() > 0.5 ? faker.internet.url() : 'NULL',
        minimum_age: faker.number.int({ min: 6, max: 18 }),
        accessibility_note: Math.random() > 0.5 ? faker.lorem.sentence(8) : 'NULL'
    });
}

const offeringIds = offerings.map(o => o.id);

console.log("Generating offering_hosts...");
// 4. OFFERING_HOSTS
for (const offering of offerings) {
    const numHosts = faker.number.int({ min: 1, max: 2 });
    const hosts = faker.helpers.arrayElements(tutorIds, numHosts);
    for (const hostId of hosts) {
        offeringHosts.push({
            offering_id: offering.id,
            user_id: hostId,
            capability: faker.helpers.arrayElement(['teach', 'assist', 'manage']),
            granted_by: offering.creator_id
        });
    }
}

console.log("Generating sessions...");
// 5. SESSIONS - 50 sessions
const sessionStatuses = ['scheduled', 'completed', 'cancelled', 'in_progress'];

for (let i = 0; i < NUM_SESSIONS; i++) {
    const sid = genUuid();
    const offering = faker.helpers.arrayElement(offerings);
    const hostId = faker.helpers.arrayElement(tutorIds);
    const startsAt = randomDateTime(0, 30);
    const endsAt = new Date(startsAt.getTime() + faker.helpers.arrayElement([60, 90, 120, 180]) * 60000);
    sessions.push({
        id: sid,
        offering_id: offering.id,
        host_id: hostId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: faker.helpers.arrayElement(sessionStatuses),
        min_participants: faker.number.int({ min: 1, max: 3 }),
        max_participants: faker.number.int({ min: 5, max: 20 }),
        version: 1,
        meeting_url: Math.random() > 0.3 ? faker.internet.url() : 'NULL',
        meeting_id: Math.random() > 0.3 ? crypto.randomUUID() : 'NULL'
    });
}

const sessionIds = sessions.map(s => s.id);

console.log("Generating bookings...");
// 6. BOOKINGS - 100 bookings
const bookingStatuses = ['confirmed', 'pending', 'cancelled', 'completed', 'no_show'];

for (let i = 0; i < NUM_BOOKINGS; i++) {
    const bid = genUuid();
    const session = faker.helpers.arrayElement(sessions);
    const learnerId = faker.helpers.arrayElement(learnerIds);
    const participantCount = faker.number.int({ min: 1, max: 3 });
    const hourlyRate = faker.helpers.arrayElement(VND_RATES);
    const duration = faker.helpers.arrayElement([60, 90, 120]);
    const pricingModel = faker.helpers.arrayElement(pricingModels);
    
    let amount;
    if (pricingModel === 'per_session') {
        amount = hourlyRate;
    } else if (pricingModel === 'per_hour') {
        amount = hourlyRate * (duration / 60);
    } else if (pricingModel === 'per_participant') {
        amount = hourlyRate * participantCount;
    } else {
        amount = hourlyRate * 4; // package
    }
    
    bookings.push({
        id: bid,
        session_id: session.id,
        learner_id: learnerId,
        participant_count: participantCount,
        status: faker.helpers.arrayElement(bookingStatuses),
        pricing_amount_vnd: Math.round(amount),
        pricing_currency: 'VND',
        pricing_hourly_rate_vnd: hourlyRate,
        pricing_duration_minutes: duration,
        pricing_model: pricingModel,
        pricing_snapshotted_at: randomPastDateTime(10).toISOString(),
        pricing_unit_price_vnd: hourlyRate,
        pricing_participant_count: participantCount,
        idempotency_key: crypto.randomUUID(),
        learner_name: faker.person.fullName(),
        learner_email: faker.internet.email(),
        learner_phone: faker.phone.number(),
        learner_note: Math.random() > 0.5 ? faker.lorem.sentence(8) : 'NULL'
    });
}

const bookingIds = bookings.map(b => b.id);

console.log("Generating payments...");
// 7. PAYMENTS - 30 payments
const paymentProviders = ['vnpay', 'momo', 'zalopay', 'stripe', 'bank_transfer'];
const paymentStatuses = ['pending', 'completed', 'failed', 'refunded'];

for (let i = 0; i < NUM_PAYMENTS; i++) {
    const pid = genUuid();
    const booking = faker.helpers.arrayElement(bookings);
    payments.push({
        id: pid,
        booking_id: booking.id,
        provider: faker.helpers.arrayElement(paymentProviders),
        status: faker.helpers.arrayElement(paymentStatuses),
        amount_vnd: booking.pricing_amount_vnd,
        currency: 'VND',
        refunded_amount_vnd: 0
    });
}

const paymentIds = payments.map(p => p.id);

console.log("Generating refunds...");
// 8. REFUNDS - 10 refunds
const refundKinds = ['full', 'partial', 'cancel_fee'];
const refundStatuses = ['pending', 'processing', 'completed', 'rejected'];

for (let i = 0; i < NUM_REFUNDS; i++) {
    const rid = genUuid();
    const payment = faker.helpers.arrayElement(payments);
    const amount = faker.number.int({ min: 10000, max: payment.amount_vnd });
    refunds.push({
        id: rid,
        payment_id: payment.id,
        kind: faker.helpers.arrayElement(refundKinds),
        status: faker.helpers.arrayElement(refundStatuses),
        amount_vnd: amount,
        idempotency_key: crypto.randomUUID(),
        provider_request_id: crypto.randomUUID(),
        provider_transaction_no: `TXN-${faker.string.numeric(8)}`,
        reason: faker.lorem.sentence(6)
    });
}

console.log("Generating tutor_reviews...");
// 9. TUTOR_REVIEWS - 50 reviews
const reviewStatuses = ['published', 'pending', 'hidden'];

// Filter completed bookings
const completedBookings = bookings.filter(b => b.status === 'completed');

for (let i = 0; i < NUM_REVIEWS; i++) {
    const tp = faker.helpers.arrayElement(tutorProfiles);
    const booking = faker.helpers.arrayElement(completedBookings.length > 0 ? completedBookings : bookings);
    reviews.push({
        id: genUuid(),
        tutor_profile_id: tp.id,
        booking_id: booking.id,
        learner_id: booking.learner_id,
        rating: faker.number.int({ min: 1, max: 5 }),
        body: faker.lorem.paragraph(2),
        status: faker.helpers.arrayElement(reviewStatuses)
    });
}

console.log("Generating notifications...");
// 10. NOTIFICATIONS - 100 notifications
const notificationEvents = ['booking_confirmed', 'session_reminder', 'payment_received', 'review_received', 'session_cancelled', 'new_message'];

for (let i = 0; i < NUM_NOTIFICATIONS; i++) {
    notifications.push({
        id: genUuid(),
        user_id: faker.helpers.arrayElement(allUserIds),
        event: faker.helpers.arrayElement(notificationEvents),
        title: faker.lorem.sentence(4).replace(/\.$/, ''),
        body: faker.lorem.sentence(10),
        href: Math.random() > 0.5 ? faker.internet.url() : 'NULL',
        read_at: Math.random() > 0.3 ? randomPastDateTime(5).toISOString() : 'NULL',
        created_at: randomPastDateTime(30).toISOString()
    });
}

console.log("Generating tutor_views...");
// 11. TUTOR_VIEWS - 200 views
for (let i = 0; i < NUM_TUTOR_VIEWS; i++) {
    tutorViews.push({
        id: genUuid(),
        tutor_profile_id: faker.helpers.arrayElement(tutorProfileIds),
        viewer_id: faker.helpers.arrayElement(allUserIds),
        created_at: randomPastDateTime(30).toISOString()
    });
}

// Write SQL file
console.log("Writing SQL file...");
const outputPath = '/Users/soshi/Documents/tutormatch/seed_data.sql';
const file = fs.createWriteStream(outputPath);

file.write("-- Seed data for Tutoria database\n");
file.write("-- Generated with Vietnamese locale (vi_VN)\n");
file.write(`-- Timestamp: ${new Date().toISOString()}\n\n`);

let totalStatements = 0;

// 1. profiles
const profileCols = ['id', 'email', 'name', 'role', 'phone', 'avatar_url', 'created_at', 'updated_at'];
const profileVals = profiles.map(p => [
    sqlEscape(p.id), sqlEscape(p.email), sqlEscape(p.name), sqlEscape(p.role),
    sqlEscape(p.phone), sqlEscape(p.avatar_url), sqlEscape(p.created_at), sqlEscape(p.updated_at)
]);
totalStatements += writeSql(file, 'profiles', profileCols, profileVals);

// 2. tutor_profiles
const tpCols = ['id', 'user_id', 'display_name', 'headline', 'bio', 'hourly_rate_vnd', 'currency',
    'teaching_format', 'avatar_object_path', 'publication_status', 'published_at',
    'unpublished_at', 'version', 'role', 'intro_video_object_path', 'portfolio_url',
    'lesson_description', 'cancel_learner_policy', 'cancel_late_policy', 'no_show_policy',
    'booking_notice', 'booking_window_days', 'lesson_buffer_min', 'same_day_booking',
    'display_duration_min', 'rates', 'consultation', 'verification_status', 'search_vector'];
const tpVals = tutorProfiles.map(tp => [
    sqlEscape(tp.id), sqlEscape(tp.user_id), sqlEscape(tp.display_name), sqlEscape(tp.headline),
    sqlEscape(tp.bio), String(tp.hourly_rate_vnd), sqlEscape(tp.currency),
    sqlEscape(tp.teaching_format), sqlEscape(tp.avatar_object_path), sqlEscape(tp.publication_status),
    sqlEscape(tp.published_at), sqlEscape(tp.unpublished_at), String(tp.version), sqlEscape(tp.role),
    sqlEscape(tp.intro_video_object_path), sqlEscape(tp.portfolio_url), sqlEscape(tp.lesson_description),
    sqlEscape(tp.cancel_learner_policy), sqlEscape(tp.cancel_late_policy), sqlEscape(tp.no_show_policy),
    String(tp.booking_notice), String(tp.booking_window_days), String(tp.lesson_buffer_min),
    tp.same_day_booking, String(tp.display_duration_min), sqlEscape(tp.rates),
    tp.consultation, sqlEscape(tp.verification_status), tp.search_vector
]);
totalStatements += writeSql(file, 'tutor_profiles', tpCols, tpVals);

// 3. offerings
const offeringCols = ['id', 'kind', 'slug', 'title', 'creator_id', 'description', 'unit_price_vnd',
    'currency', 'config', 'publication_status', 'pricing_model', 'price_per_participant_vnd',
    'hourly_rate_vnd', 'booking_mode', 'map_url', 'minimum_age', 'accessibility_note'];
const offeringVals = offerings.map(o => [
    sqlEscape(o.id), sqlEscape(o.kind), sqlEscape(o.slug), sqlEscape(o.title),
    sqlEscape(o.creator_id), sqlEscape(o.description), String(o.unit_price_vnd),
    sqlEscape(o.currency), sqlEscape(o.config), sqlEscape(o.publication_status),
    sqlEscape(o.pricing_model), String(o.price_per_participant_vnd), String(o.hourly_rate_vnd),
    sqlEscape(o.booking_mode), sqlEscape(o.map_url), String(o.minimum_age), sqlEscape(o.accessibility_note)
]);
totalStatements += writeSql(file, 'offerings', offeringCols, offeringVals);

// 4. offering_hosts
const ohCols = ['offering_id', 'user_id', 'capability', 'granted_by'];
const ohVals = offeringHosts.map(oh => [
    sqlEscape(oh.offering_id), sqlEscape(oh.user_id), sqlEscape(oh.capability), sqlEscape(oh.granted_by)
]);
totalStatements += writeSql(file, 'offering_hosts', ohCols, ohVals);

// 5. sessions
const sessionCols = ['id', 'offering_id', 'host_id', 'starts_at', 'ends_at', 'status',
    'min_participants', 'max_participants', 'version', 'meeting_url', 'meeting_id'];
const sessionVals = sessions.map(s => [
    sqlEscape(s.id), sqlEscape(s.offering_id), sqlEscape(s.host_id),
    sqlEscape(s.starts_at), sqlEscape(s.ends_at), sqlEscape(s.status),
    String(s.min_participants), String(s.max_participants), String(s.version),
    sqlEscape(s.meeting_url), sqlEscape(s.meeting_id)
]);
totalStatements += writeSql(file, 'sessions', sessionCols, sessionVals);

// 6. bookings
const bookingCols = ['id', 'session_id', 'learner_id', 'participant_count', 'status',
    'pricing_amount_vnd', 'pricing_currency', 'pricing_hourly_rate_vnd',
    'pricing_duration_minutes', 'pricing_model', 'pricing_snapshotted_at',
    'pricing_unit_price_vnd', 'pricing_participant_count', 'idempotency_key',
    'learner_name', 'learner_email', 'learner_phone', 'learner_note'];
const bookingVals = bookings.map(b => [
    sqlEscape(b.id), sqlEscape(b.session_id), sqlEscape(b.learner_id),
    String(b.participant_count), sqlEscape(b.status), String(b.pricing_amount_vnd),
    sqlEscape(b.pricing_currency), String(b.pricing_hourly_rate_vnd),
    String(b.pricing_duration_minutes), sqlEscape(b.pricing_model),
    sqlEscape(b.pricing_snapshotted_at), String(b.pricing_unit_price_vnd),
    String(b.pricing_participant_count), sqlEscape(b.idempotency_key),
    sqlEscape(b.learner_name), sqlEscape(b.learner_email), sqlEscape(b.learner_phone),
    sqlEscape(b.learner_note)
]);
totalStatements += writeSql(file, 'bookings', bookingCols, bookingVals);

// 7. payments
const paymentCols = ['id', 'booking_id', 'provider', 'status', 'amount_vnd', 'currency', 'refunded_amount_vnd'];
const paymentVals = payments.map(p => [
    sqlEscape(p.id), sqlEscape(p.booking_id), sqlEscape(p.provider), sqlEscape(p.status),
    String(p.amount_vnd), sqlEscape(p.currency), String(p.refunded_amount_vnd)
]);
totalStatements += writeSql(file, 'payments', paymentCols, paymentVals);

// 8. refunds
const refundCols = ['id', 'payment_id', 'kind', 'status', 'amount_vnd', 'idempotency_key',
    'provider_request_id', 'provider_transaction_no', 'reason'];
const refundVals = refunds.map(r => [
    sqlEscape(r.id), sqlEscape(r.payment_id), sqlEscape(r.kind), sqlEscape(r.status),
    String(r.amount_vnd), sqlEscape(r.idempotency_key), sqlEscape(r.provider_request_id),
    sqlEscape(r.provider_transaction_no), sqlEscape(r.reason)
]);
totalStatements += writeSql(file, 'refunds', refundCols, refundVals);

// 9. tutor_reviews
const reviewCols = ['id', 'tutor_profile_id', 'booking_id', 'learner_id', 'rating', 'body', 'status'];
const reviewVals = reviews.map(r => [
    sqlEscape(r.id), sqlEscape(r.tutor_profile_id), sqlEscape(r.booking_id),
    sqlEscape(r.learner_id), String(r.rating), sqlEscape(r.body), sqlEscape(r.status)
]);
totalStatements += writeSql(file, 'tutor_reviews', reviewCols, reviewVals);

// 10. notifications
const notifCols = ['id', 'user_id', 'event', 'title', 'body', 'href', 'read_at', 'created_at'];
const notifVals = notifications.map(n => [
    sqlEscape(n.id), sqlEscape(n.user_id), sqlEscape(n.event), sqlEscape(n.title),
    sqlEscape(n.body), sqlEscape(n.href), sqlEscape(n.read_at), sqlEscape(n.created_at)
]);
totalStatements += writeSql(file, 'notifications', notifCols, notifVals);

// 11. tutor_views
const tvCols = ['id', 'tutor_profile_id', 'viewer_id', 'created_at'];
const tvVals = tutorViews.map(tv => [
    sqlEscape(tv.id), sqlEscape(tv.tutor_profile_id), sqlEscape(tv.viewer_id), sqlEscape(tv.created_at)
]);
totalStatements += writeSql(file, 'tutor_views', tvCols, tvVals);

file.end();

console.log(`Done! Generated ${totalStatements} INSERT statements`);
console.log(`Output: ${outputPath}`);
