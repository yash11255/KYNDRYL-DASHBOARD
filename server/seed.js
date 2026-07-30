require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const School = require('./models/School');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bharat-cares-pathshala');
  console.log('Connected to MongoDB');

  // ── Migrate old 'admin' role → 'super_admin' ──────────────────────
  const migrated = await User.updateMany({ role: 'admin' }, { role: 'super_admin' });
  if (migrated.modifiedCount) console.log(`Migrated ${migrated.modifiedCount} admin(s) → super_admin`);

  // ── Super Admin ───────────────────────────────────────────────────
  const adminExists = await User.findOne({ email: 'admin@bharatcares.in' });
  if (!adminExists) {
    await User.create({
      name: 'Program Admin',
      email: 'admin@bharatcares.in',
      password: 'Admin@1234',
      role: 'super_admin',
    });
    console.log('Super Admin created: admin@bharatcares.in / Admin@1234');
  }

  // ── Manager ───────────────────────────────────────────────────────
  let mgr = await User.findOne({ email: 'manager@bharatcares.in' });
  if (!mgr) {
    mgr = await User.create({
      name: 'Regional Manager',
      email: 'manager@bharatcares.in',
      password: 'Manager@123',
      role: 'manager',
      phone: '9800000001',
      employeeId: 'MGR001',
    });
    console.log('Manager created: manager@bharatcares.in / Manager@123');
  }

  // ── Team Lead (optional layer) ─────────────────────────────────────
  let tl = await User.findOne({ email: 'lead@bharatcares.in' });
  if (!tl) {
    tl = await User.create({
      name: 'Team Lead Rajasthan',
      email: 'lead@bharatcares.in',
      password: 'Lead@123',
      role: 'team_lead',
      district: 'Jaipur',
      team: 'Team A',
      managerId: mgr._id,
      phone: '9800000002',
      employeeId: 'TL001',
    });
    console.log('Team Lead created: lead@bharatcares.in / Lead@123');
  }

  // ── Trainers ─────────────────────────────────────────────────────
  const trainers = [
    { name: 'Priya Sharma',  email: 'priya@bharatcares.in', password: 'Trainer@123', phone: '9876543210', district: 'Jaipur', employeeId: 'TR001', role: 'trainer', managerId: mgr._id, teamLeadId: tl._id, team: 'Team A' },
    { name: 'Ravi Kumar',    email: 'ravi@bharatcares.in',  password: 'Trainer@123', phone: '9876543211', district: 'Ajmer',  employeeId: 'TR002', role: 'trainer', managerId: mgr._id, team: 'Team B' },
  ];
  for (const t of trainers) {
    if (!await User.findOne({ email: t.email })) {
      await User.create(t);
      console.log(`Trainer created: ${t.email}`);
    }
  }

  // ── Reviewer ─────────────────────────────────────────────────────
  if (!await User.findOne({ email: 'reviewer@bharatcares.in' })) {
    await User.create({
      name: 'Quality Reviewer',
      email: 'reviewer@bharatcares.in',
      password: 'Review@123',
      role: 'reviewer',
      managerId: mgr._id,
      phone: '9800000099',
      employeeId: 'RV001',
    });
    console.log('Reviewer created: reviewer@bharatcares.in / Review@123');
  }

  // ── Schools ──────────────────────────────────────────────────────
  const schools = [
    {
      name: 'Govt. Senior Secondary School Sanganer',
      district: 'Jaipur', block: 'Sanganer',
      address: 'Sanganer, Jaipur, Rajasthan',
      googleMapsLink: 'https://maps.google.com/?q=Sanganer+Jaipur',
      principalName: 'Mr. Ashok Verma', principalPhone: '9414001001',
      spokeContactName: 'Ramesh Meena', spokeContactPhone: '9414005001',
      totalStudents: 450,
    },
    {
      name: 'Govt. Girls School Kishangarh',
      district: 'Ajmer', block: 'Kishangarh',
      address: 'Kishangarh, Ajmer, Rajasthan',
      googleMapsLink: 'https://maps.google.com/?q=Kishangarh+Ajmer',
      principalName: 'Mrs. Sunita Joshi', principalPhone: '9414002002',
      spokeContactName: 'Kavita Sharma', spokeContactPhone: '9414005002',
      totalStudents: 380,
    },
    {
      name: 'Govt. Higher Secondary School Phulera',
      district: 'Jaipur', block: 'Phulera',
      address: 'Phulera, Jaipur, Rajasthan',
      googleMapsLink: 'https://maps.google.com/?q=Phulera+Jaipur',
      principalName: 'Mr. Ramesh Gupta', principalPhone: '9414003003',
      spokeContactName: 'Suresh Yadav', spokeContactPhone: '9414005003',
      totalStudents: 520,
    },
  ];
  for (const s of schools) {
    if (!await School.findOne({ name: s.name })) {
      await School.create(s);
      console.log(`School created: ${s.name}`);
    } else {
      // Update existing schools with spoke contacts
      await School.findOneAndUpdate({ name: s.name }, {
        spokeContactName: s.spokeContactName,
        spokeContactPhone: s.spokeContactPhone,
      });
    }
  }

  console.log('\n✅ Seed complete!');
  console.log('Credentials:');
  console.log('  Super Admin : admin@bharatcares.in / Admin@1234');
  console.log('  Manager     : manager@bharatcares.in / Manager@123');
  console.log('  Team Lead   : lead@bharatcares.in / Lead@123');
  console.log('  Trainer 1   : priya@bharatcares.in / Trainer@123');
  console.log('  Trainer 2   : ravi@bharatcares.in / Trainer@123');
  console.log('  Reviewer    : reviewer@bharatcares.in / Review@123');
  process.exit(0);
};

seed().catch(err => { console.error(err); process.exit(1); });
