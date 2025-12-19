require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const PushSubscription = require('../src/models/pushSubscriptionModel');
const Usuario = require('../src/models/usuarioModel'); // Assuming separate file, or check require path

async function diagnoseNotifications() {
    try {
        await connectDB();
        console.log('✅ Connected to DB');

        // 1. Check for Admin Users
        const admins = await Usuario.find({ role: 'admin' });
        console.log(`\n👥 1. Admin Users Found: ${admins.length}`);
        admins.forEach(admin => {
            console.log(`   - ${admin.nome} (${admin.email}) | ID: ${admin._id}`);
        });

        // 2. Check for ALL Subscriptions
        const allSubs = await PushSubscription.find({});
        console.log(`\n🔔 2. Total Subscriptions Found: ${allSubs.length}`);

        allSubs.forEach(sub => {
            console.log(`   - UserID: ${sub.usuarioId} | isAdmin: ${sub.isAdmin}`);
        });

        // 3. Match
        const adminIds = admins.map(a => a._id.toString());
        const adminSubs = allSubs.filter(s => adminIds.includes(s.usuarioId.toString()));

        console.log(`\n🔗 3. Subscriptions belonging to Admins: ${adminSubs.length}`);
        if (adminSubs.length === 0) {
            console.log("❌ PROBLEM IDENTIFIED: No subscriptions found for any existing Admin user.");
            console.log("👉 ACTION: Admins must toggle notifications OFF and ON again in the frontend settings.");
        } else {
            console.log("⚠️ Strange... subscriptions exist for admins but 'isAdmin' flag might be false in PushSubscription model?");
            adminSubs.forEach(s => {
                console.log(`   - Sub ID: ${s._id} | User: ${s.usuarioId} | Recorded isAdmin: ${s.isAdmin} (Should be true)`);
            });
        }

    } catch (error) {
        console.error('❌ Error during diagnosis:', error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

diagnoseNotifications();
