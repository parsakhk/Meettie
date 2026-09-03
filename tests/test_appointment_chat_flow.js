import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY
);

async function runFlowTest() {
  console.log('=== Starting Appointment & Chat Integration Verification ===\n');

  // 1. Fetch an existing calendar
  const { data: cals, error: calErr } = await supabase.from('calendars').select('*').limit(1);
  if (calErr || !cals || cals.length === 0) {
    throw new Error('No calendars found to test with: ' + JSON.stringify(calErr));
  }

  const testCal = cals[0];
  console.log(`✓ Using Calendar: "${testCal.name}" (ID: ${testCal.id}, Owner ID: ${testCal.user_id})`);

  // 2. Fetch a user to act as client
  const { data: profiles, error: profErr } = await supabase.from('profiles').select('*').limit(2);
  if (profErr || !profiles || profiles.length === 0) {
    throw new Error('No profiles found to test with: ' + JSON.stringify(profErr));
  }

  const clientProfile = profiles.find(p => p.id !== testCal.user_id) || profiles[0];
  console.log(`✓ Using Client: @${clientProfile.username} (ID: ${clientProfile.id})`);

  // 3. Create a test appointment
  const now = new Date();
  const startTime = new Date(now.getTime() + 86400000); // tomorrow
  const endTime = new Date(startTime.getTime() + 3600000);

  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      calendar_id: testCal.id,
      user_id: clientProfile.id,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: 'pending',
      notes: JSON.stringify({
        title: 'Integration Test Appointment',
        description: 'Verifying appointment acceptance and chat initiation'
      }),
      is_private: false
    })
    .select()
    .single();

  if (apptErr) {
    throw new Error('Failed to create appointment: ' + JSON.stringify(apptErr));
  }
  console.log(`✓ Created Pending Appointment (ID: ${appt.id}, status: ${appt.status})`);

  // 4. Accept Appointment Flow:
  // - Update appointment to 'accepted'
  const { data: acceptedAppt, error: acceptErr } = await supabase
    .from('appointments')
    .update({ status: 'accepted' })
    .eq('id', appt.id)
    .select()
    .single();

  if (acceptErr) {
    throw new Error('Failed to update appointment to accepted: ' + JSON.stringify(acceptErr));
  }
  console.log(`✓ Appointment status updated to: ${acceptedAppt.status}`);

  // - Find or create chat room between owner and client
  const ownerId = testCal.user_id;
  const clientId = clientProfile.id;

  const { data: existingRooms } = await supabase
    .from('chat_rooms')
    .select('*')
    .or(`and(initiator_id.eq.${ownerId},receiver_id.eq.${clientId}),and(initiator_id.eq.${clientId},receiver_id.eq.${ownerId})`);

  let roomId = null;
  let createdTestRoom = false;

  if (existingRooms && existingRooms.length > 0) {
    roomId = existingRooms[0].id;
    console.log(`✓ Existing Chat Room found (ID: ${roomId})`);
  } else {
    const { data: newRoom, error: newRoomErr } = await supabase
      .from('chat_rooms')
      .insert({
        initiator_id: ownerId,
        receiver_id: clientId,
        status: 'accepted'
      })
      .select()
      .single();

    if (newRoomErr) {
      throw new Error('Failed to create chat room: ' + JSON.stringify(newRoomErr));
    }
    roomId = newRoom.id;
    createdTestRoom = true;
    console.log(`✓ Created new Chat Room with accepted status (ID: ${roomId})`);
  }

  // - Send confirmation message
  const { data: message, error: msgErr } = await supabase
    .from('messages')
    .insert({
      chat_room_id: roomId,
      sender_id: ownerId,
      content: `📅 Appointment Confirmed: "Integration Test Appointment" on ${startTime.toLocaleDateString()}. Chat conversation is open!`
    })
    .select()
    .single();

  if (msgErr) {
    throw new Error('Failed to insert initial confirmation message: ' + JSON.stringify(msgErr));
  }
  console.log(`✓ Confirmation message posted into chat (Message ID: ${message.id})`);

  // 5. Cleanup test data
  console.log('\n--- Cleaning up test records ---');
  await supabase.from('messages').delete().eq('id', message.id);
  if (createdTestRoom) {
    await supabase.from('chat_rooms').delete().eq('id', roomId);
  }
  await supabase.from('appointments').delete().eq('id', appt.id);
  console.log('✓ Cleaned up test message, room, and appointment.');

  console.log('\n🎉 ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');
}

runFlowTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
