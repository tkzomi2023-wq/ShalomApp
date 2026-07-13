import fetch from 'node-fetch'; // wait, wait! node-fetch is not installed or might not be needed because node 18+ has native fetch. Let's use native fetch!

const url = 'https://iteftlbwpefnmikjvast.supabase.co/functions/v1/send-email';
const anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZWZ0bGJ3cGVmbm1pa2p2YXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NjkzMTQsImV4cCI6MjA5OTI0NTMxNH0.VFnqfV-8dJt4tNw7h0L-FFDkwvhCpgYt1QlH3nMZBbc';

async function testStatus() {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${anonKey}`
      },
      body: JSON.stringify({ action: 'status' })
    });
    console.log('Status code:', res.status);
    const json = await res.json();
    console.log('Response JSON:', JSON.stringify(json, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

testStatus();
