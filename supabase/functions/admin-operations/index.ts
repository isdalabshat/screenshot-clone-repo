import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action, userId, targetUserId } = body;
    console.log('Admin operation:', action, 'requestedBy:', userId, 'target:', targetUserId);

    // First verify the requesting user is an admin
    const { data: adminCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('role', 'admin')
      .maybeSingle();

    if (!adminCheck) {
      console.log('Unauthorized: User is not admin:', userId);
      return new Response(JSON.stringify({ error: 'Unauthorized: Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    switch (action) {
      case 'get_user_emails': {
        // Get all profiles first
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, username, chips')
          .order('username');

        if (profilesError) {
          console.log('Error fetching profiles:', profilesError);
          return new Response(JSON.stringify({ error: 'Failed to fetch profiles' }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Fetch emails from auth.users for each profile
        const usersWithEmail = await Promise.all((profiles || []).map(async (p) => {
          const { data: authData } = await supabase.auth.admin.getUserById(p.user_id);
          return {
            id: p.user_id,
            oduserId: p.user_id,
            username: p.username,
            chips: p.chips,
            email: authData?.user?.email || 'N/A'
          };
        }));

        console.log('Fetched', usersWithEmail.length, 'users with emails');

        return new Response(JSON.stringify({ success: true, users: usersWithEmail }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      case 'delete_user': {
        if (!targetUserId) {
          return new Response(JSON.stringify({ error: 'Target user ID required' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('Deleting user:', targetUserId);

        // Delete all related data first
        const { error: lucky9Error } = await supabase
          .from('lucky9_players')
          .delete()
          .eq('user_id', targetUserId);
        if (lucky9Error) console.log('Error deleting lucky9_players:', lucky9Error);

        const { error: tablePlayersError } = await supabase
          .from('table_players')
          .delete()
          .eq('user_id', targetUserId);
        if (tablePlayersError) console.log('Error deleting table_players:', tablePlayersError);

        const { error: cashRequestsError } = await supabase
          .from('cash_requests')
          .delete()
          .eq('user_id', targetUserId);
        if (cashRequestsError) console.log('Error deleting cash_requests:', cashRequestsError);

        const { error: chatMessagesError } = await supabase
          .from('chat_messages')
          .delete()
          .eq('user_id', targetUserId);
        if (chatMessagesError) console.log('Error deleting chat_messages:', chatMessagesError);

        const { error: gameActionsError } = await supabase
          .from('game_actions')
          .delete()
          .eq('user_id', targetUserId);
        if (gameActionsError) console.log('Error deleting game_actions:', gameActionsError);

        const { error: userRolesError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', targetUserId);
        if (userRolesError) console.log('Error deleting user_roles:', userRolesError);

        const { error: profilesError } = await supabase
          .from('profiles')
          .delete()
          .eq('user_id', targetUserId);
        if (profilesError) console.log('Error deleting profiles:', profilesError);

        // Delete auth user using service role
        const { error: authError } = await supabase.auth.admin.deleteUser(targetUserId);
        
        if (authError) {
          console.log('Error deleting auth user:', authError);
          return new Response(JSON.stringify({ error: authError.message }), {
            status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('Successfully deleted user:', targetUserId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Admin operation error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
