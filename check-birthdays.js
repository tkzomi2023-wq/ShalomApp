import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://iteftlbwpefnmikjvast.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZWZ0bGJ3cGVmbm1pa2p2YXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NjkzMTQsImV4cCI6MjA5OTI0NTMxNH0.VFnqfV-8dJt4tNw7h0L-FFDkwvhCpgYt1QlH3nMZBbc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
  const { data: members, error } = await supabase
    .from('profiles')
    .select('name, status, dob, email, email_notifications');
  
  if (error) {
    console.error('Error fetching profiles:', error);
    return;
  }

  console.log('Total profiles fetched:', members?.length);
  const approved = members?.filter(m => m.status === 'approved') || [];
  console.log('Approved profiles:', approved.length);
  console.log('All profiles with DOB:');
  members?.forEach(m => {
    console.log(`- ${m.name} (${m.status}): DOB = ${m.dob}, Email = ${m.email}, Notify = ${m.email_notifications}`);
  });
}

check();
