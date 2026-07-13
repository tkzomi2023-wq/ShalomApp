/**
 * Robust API Fetch Utility for Shalom Youth App
 * Handles base URLs, single-endpoint Supabase Edge Functions, 
 * Netlify-specific deployment constraints, and includes retries with exponential backoff.
 */

export const getApiUrl = (path: string): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
  if (!baseUrl) {
    return path;
  }
  const cleanBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  
  // If the base URL is specifically a single function endpoint (like .../functions/v1/send-email)
  // and the requested path is a birthday-email action, we direct the fetch to the function directly.
  if (cleanBase.includes('/functions/v1/send-email')) {
    if (path.includes('/birthday-email')) {
      return cleanBase;
    }
  }
  
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
};

/**
 * Parses response as JSON, throwing descriptive errors if the response is empty or HTML.
 */
export const safeJsonParse = async (response: Response) => {
  const text = await response.text();
  if (!text || text.trim() === '') {
    throw new Error('Empty response received from server. This indicates that your Node.js backend is not running or reachable at this endpoint.');
  }
  if (text.trim().startsWith('<')) {
    throw new Error('Static HTML response received instead of JSON. This typically happens when the API backend routes are not configured or are unreachable on static hosting (like Netlify). Please verify your VITE_API_BASE_URL env setting.');
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse response as JSON: ${text.substring(0, 100)}...`);
  }
};

interface ApiFetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

/**
 * Robust fetch wrapper with retries, request adapters for Edge Functions, and clean headers.
 */
export const apiFetch = async (path: string, options: ApiFetchOptions = {}): Promise<Response> => {
  const { retries = 3, retryDelay = 1000, ...fetchOptions } = options;
  let url = getApiUrl(path);
  const headers = new Headers(fetchOptions.headers || {});
  
  const isSupabase = url.includes('supabase.co');
  
  // Adapt requests for single-endpoint Supabase Edge Functions
  if (isSupabase && url.endsWith('/send-email')) {
    // 1. Add required Authorization Bearer header
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0ZWZ0bGJ3cGVmbm1pa2p2YXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NjkzMTQsImV4cCI6MjA5OTI0NTMxNH0.VFnqfV-8dJt4tNw7h0L-FFDkwvhCpgYt1QlH3nMZBbc';
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${anonKey}`);
    }
    
    // 2. Identify intended action from path
    let action = '';
    if (path.includes('/status')) {
      action = 'status';
    } else if (path.includes('/smtp-config')) {
      action = 'smtp-config';
    } else if (path.includes('/send-wish')) {
      action = 'send-wish';
    } else if (path.includes('/trigger')) {
      action = 'trigger';
    } else if (path.includes('/preview-email')) {
      action = 'preview-email';
    }
    
    if (action) {
      const currentMethod = fetchOptions.method || 'GET';
      
      // Since some CDNs (like Netlify) or Edge Functions block custom GET headers 
      // or do not support sub-routing on GET, we safely map all GET/POST requests 
      // targeting `/send-email` to POST requests with an action body property.
      headers.set('Content-Type', 'application/json');
      fetchOptions.method = 'POST';
      
      let bodyObj: any = { action };
      
      // If original was a POST with an existing body, merge it
      if (currentMethod === 'POST' && fetchOptions.body) {
        try {
          const originalBody = JSON.parse(fetchOptions.body as string);
          bodyObj = { ...bodyObj, ...originalBody };
        } catch (e) {
          console.warn('Failed to parse original POST body, forwarding as-is:', e);
        }
      } 
      // If original was a GET with query parameters in path, extract and merge them as body attributes
      else if (path.includes('?')) {
        const queryStr = path.split('?')[1];
        const params = new URLSearchParams(queryStr);
        params.forEach((val, key) => {
          bodyObj[key] = val;
        });
      }
      
      fetchOptions.body = JSON.stringify(bodyObj);
    }
  }

  let lastError: any = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        ...fetchOptions,
        headers,
      });
      
      // If successful or client error (4xx) that is not transient, return response
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429)) {
        return res;
      }
      
      // Transient server/rate errors triggers retry
      throw new Error(`Server responded with status code ${res.status}`);
    } catch (err: any) {
      lastError = err;
      console.warn(`[API Fetch] Attempt ${attempt + 1} failed for ${url}:`, err);
      
      if (attempt < retries - 1) {
        // Back off exponentially
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // If we reach here, all retries failed
  const errorMsg = lastError?.message || 'Unknown network error';
  
  // Create an explicit descriptive error for Netlify / Header blocking / API failure
  let descriptiveError = `API request failed: ${errorMsg}.`;
  if (isSupabase) {
    descriptiveError += ` This occurred while communicating with your Supabase Edge Function. Please check:
1. That your Supabase Anon Key and API URL are correctly configured.
2. If deployed on Netlify, that the Netlify function is not blocking requests or stripping required headers like 'Authorization'.
3. Your internet connection and network CORS logs.`;
  } else {
    descriptiveError += ` If you are using Netlify, verify that your server environment variables are fully configured, and that the backend container is running and accessible.`;
  }
  
  throw new Error(descriptiveError);
};
