import fetch from 'node-fetch'; // native fetch

const url = 'https://iteftlbwpefnmikjvast.supabase.co/functions/v1/send-email';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZWZ0bGJ3cGVmbm1pa2p2YXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NjkzMTQsImV4cCI6MjA5OTI0NTMxNH0.VFnqfV-8dJt4tNw7h0L-FFDkwvhCpgYt1QlH3nMZBbc';

async function testTrigger() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ action: 'trigger', force: true })
    });
    console.log('Trigger code:', res.status);
    const json = await res.json();
    console.log('Trigger JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testTrigger();
