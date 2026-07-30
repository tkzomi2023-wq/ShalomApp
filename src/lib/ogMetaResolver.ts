/**
 * Open Graph Meta Resolver for Shalom Youth App
 * Maps request paths and URLs to dynamic meta tags and OG image generator options.
 */

import { supabase } from './supabase';
import { OgImageOptions } from './ogImageGenerator';
import { INITIAL_SCHEDULES } from './schedule';

export interface PageMetaData {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  ogType: string;
  ogImage: string;
  ogImageSecure: string;
  siteUrl: string;
  ogImageOptions: OgImageOptions;
}

export function formatMemberName(
  name: string,
  gender?: string,
  maritalStatus?: string
): string {
  if (!name) return '';
  if (!gender) return name;
  const lowerGender = gender.toLowerCase();
  let cleanName = name.trim();
  const isMarried = maritalStatus?.toLowerCase() === 'married';
  
  if (lowerGender === 'male') {
    if (isMarried) {
      if (/^(Tg\.|Tg)\s+/i.test(cleanName)) {
        cleanName = cleanName.replace(/^(Tg\.|Tg)\s+/i, 'Pa ');
      } else if (!/^(Pa\.|Pa)\s+/i.test(cleanName)) {
        cleanName = `Pa ${cleanName}`;
      }
    } else {
      if (/^(Pa\.|Pa)\s+/i.test(cleanName)) {
        cleanName = cleanName.replace(/^(Pa\.|Pa)\s+/i, 'Tg. ');
      } else if (!/^(Tg\.|Tg)\s+/i.test(cleanName)) {
        cleanName = `Tg. ${cleanName}`;
      }
    }
  } else if (lowerGender === 'female') {
    if (!/^(Lia\.|Lia)\s+/i.test(cleanName)) {
      cleanName = `Lia ${cleanName}`;
    }
  }
  return cleanName;
}

/**
 * Resolves metadata and OG image options for any route path.
 */
export async function resolveMetaDataForPath(
  rawPath: string,
  baseUrl?: string
): Promise<PageMetaData> {
  const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const effectiveBase = baseUrl || defaultOrigin;
  const cleanBase = effectiveBase.replace(/\/+$/, '');
  const cleanPath = (rawPath || '/').split('?')[0].split('#')[0];
  const canonicalUrl = `${cleanBase}${cleanPath === '/' ? '' : cleanPath}`;

  // Fetch configured Default OG Fallback Image from meta_configs or meta_settings if available
  let configuredDefaultOgImage: string | undefined = undefined;
  try {
    let dbMeta: any = null;
    const { data: mc } = await supabase
      .from('meta_configs')
      .select('default_og_image, og_image')
      .eq('id', 'singleton')
      .maybeSingle();
    dbMeta = mc;

    if (!dbMeta) {
      const { data: ms } = await supabase
        .from('meta_settings')
        .select('default_og_image, og_image')
        .eq('id', 'singleton')
        .maybeSingle();
      dbMeta = ms;
    }

    if (dbMeta) {
      configuredDefaultOgImage = dbMeta.default_og_image || dbMeta.og_image;
    }
  } catch (err) {}

  // Default Fallback Metadata
  let title = 'Shalom Youth Fellowship - Assembly of God Church | JSAG';
  let description = 'Connecting youth, empowering faith, and celebrating fellowship at Shalom Youth Fellowship (Assembly of God Church, JSAG Aizawl).';
  let keywords = 'Shalom Youth, Youth Fellowship, JSAG, Assemblies of God, Mizoram, Christian Youth, Aizawl Worship';
  let ogType = 'website';
  let ogImageOptions: OgImageOptions = {
    pageType: 'home',
    title: 'Shalom Youth Fellowship',
    subtitle: 'Assemblies of God Church • JSAG Aizawl',
    description: 'Connecting Youth, Empowering Faith, & Celebrating Fellowship',
    defaultOgImage: configuredDefaultOgImage,
    siteUrl: cleanBase
  };

  const segments = cleanPath.split('/').filter(Boolean);
  const firstSeg = (segments[0] || '').toLowerCase();
  const secondSeg = segments[1] ? decodeURIComponent(segments[1]) : '';

  // 1. User Profile Pages (/profile/:id, /profile/:username, /members/:id)
  if (firstSeg === 'profile' || firstSeg === 'members' || firstSeg === 'member') {
    const userIdOrName = secondSeg || 'me';
    let profileData: any = null;

    if (userIdOrName !== 'me') {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${userIdOrName},username.eq.${userIdOrName},email.eq.${userIdOrName}`)
          .maybeSingle();

        if (!error && data) {
          profileData = data;
        }
      } catch (err) {
        console.warn('Failed to query Supabase profile for OG resolution:', err);
      }
    }

    if (profileData) {
      const formattedName = formatMemberName(
        profileData.display_name || profileData.name || 'Youth Member',
        profileData.gender,
        profileData.marital_status
      );
      const role = profileData.role || 'Member';
      const bial = profileData.bial || 'JSAG Assembly';

      title = `${formattedName}'s Profile | Shalom Youth Fellowship`;
      description = `${formattedName} (${role}) - Shalom Youth Fellowship, JSAG Church, Aizawl. ${bial ? `Bial: ${bial}.` : ''}`;
      ogType = 'profile';

      ogImageOptions = {
        pageType: 'profile',
        title: formattedName,
        subtitle: `${role} • ${bial}`,
        description: `Member at Shalom Youth Fellowship, Mizoram Assemblies of God Church.`,
        roleBadge: `${role.toUpperCase()} MEMBER`,
        avatarUrl: profileData.avatar,
        category: 'MEMBER PROFILE CARD',
        siteUrl: cleanBase,
        metaDetails: [
          { label: 'ROLE', value: role },
          { label: 'BIAL', value: bial }
        ]
      };
    } else {
      title = `Member Profile | Shalom Youth Fellowship`;
      description = `View youth member profile and fellowship activity at Shalom Youth Fellowship, JSAG Church.`;
      ogType = 'profile';

      ogImageOptions = {
        pageType: 'profile',
        title: 'Shalom Youth Member',
        subtitle: 'Mizoram Assemblies of God Church',
        description: 'Youth Fellowship Community Member Profile',
        roleBadge: 'YOUTH MEMBER',
        category: 'MEMBER PROFILE CARD',
        defaultOgImage: configuredDefaultOgImage,
        isFallback: true,
        siteUrl: cleanBase
      };
    }
  }

  // 2. Worship Service & Schedule (/services, /services/:id, /schedules, /schedules/:id)
  else if (firstSeg === 'services' || firstSeg === 'service' || firstSeg === 'schedules' || firstSeg === 'schedule') {
    let serviceData: any = null;

    if (secondSeg) {
      try {
        const { data } = await supabase
          .from('schedules')
          .select('*')
          .eq('id', secondSeg)
          .maybeSingle();
        serviceData = data;
      } catch (err) {}

      if (!serviceData) {
        serviceData = INITIAL_SCHEDULES.find(s => s.id === secondSeg);
      }
    }

    // Fallback to top/latest schedule if no specific ID requested
    if (!serviceData) {
      try {
        const { data } = await supabase
          .from('schedules')
          .select('*')
          .order('date', { ascending: false })
          .limit(1);
        if (data && data[0]) serviceData = data[0];
      } catch (err) {}

      if (!serviceData) {
        serviceData = INITIAL_SCHEDULES[0];
      }
    }

    if (serviceData) {
      const sTitle = serviceData.title || serviceData.topic || 'Youth Worship Service';
      const speaker = serviceData.speaker || serviceData.leader || 'Shalom Youth Speaker';

      title = `${sTitle} | Shalom Youth Service`;
      description = `Join us on ${serviceData.date || 'Sunday'} at ${serviceData.time || '04:30 PM'}. Speaker: ${speaker}. ${serviceData.venue ? `Venue: ${serviceData.venue}.` : ''}`;

      ogImageOptions = {
        pageType: 'service',
        title: sTitle,
        subtitle: serviceData.topic ? `Topic: ${serviceData.topic}` : 'Assemblies of God Church Worship',
        description: serviceData.notes || 'Connecting youth, empowering faith, and praising together in fellowship.',
        dateStr: serviceData.date,
        timeStr: serviceData.time,
        speakerStr: speaker,
        venueStr: serviceData.venue || 'Shalom Sanctuary, JSAG',
        category: 'WORSHIP SERVICE',
        siteUrl: cleanBase
      };
    } else {
      title = `Worship Services & Schedule | Shalom Youth Fellowship`;
      description = `View upcoming Sunday Youth Services, Bible Studies, and Worship Gatherings at Shalom Youth Fellowship, JSAG.`;

      ogImageOptions = {
        pageType: 'service',
        title: 'Youth Worship Service & Schedule',
        subtitle: 'Shalom Youth Fellowship • JSAG Aizawl',
        description: 'Join us for inspiring worship, scripture study, and uplifting fellowship.',
        category: 'SERVICE SCHEDULE',
        defaultOgImage: configuredDefaultOgImage,
        isFallback: true,
        siteUrl: cleanBase
      };
    }
  }

  // 3. Events (/events, /events/:id)
  else if (firstSeg === 'events' || firstSeg === 'event') {
    let eventData: any = null;
    if (secondSeg) {
      try {
        const { data } = await supabase
          .from('schedules')
          .select('*')
          .eq('id', secondSeg)
          .maybeSingle();
        eventData = data;
      } catch (err) {}
    }

    if (eventData) {
      title = `${eventData.title} | Shalom Youth Event`;
      description = `Special Event on ${eventData.date} at ${eventData.time}. Speaker/Leader: ${eventData.speaker || eventData.leader || 'Shalom Youth'}. ${eventData.venue ? `Location: ${eventData.venue}.` : ''}`;

      ogImageOptions = {
        pageType: 'event',
        title: eventData.title,
        subtitle: eventData.topic || 'Shalom Youth Fellowship Gathering',
        description: eventData.notes || 'An empowering fellowship event for youth believers.',
        dateStr: eventData.date,
        timeStr: eventData.time,
        venueStr: eventData.venue || 'JSAG Fellowship Hall',
        category: 'UPCOMING EVENT',
        defaultOgImage: configuredDefaultOgImage,
        siteUrl: cleanBase
      };
    } else {
      title = `Youth Events & Programs | Shalom Youth Fellowship`;
      description = `Explore upcoming youth fellowship retreats, music nights, Bible study camps, and sports tournaments.`;

      ogImageOptions = {
        pageType: 'event',
        title: 'Shalom Youth Events & Gatherings',
        subtitle: 'Mizoram Assemblies of God Church',
        description: 'Empowering youth through spiritual retreats, Bible camps, and fellowship.',
        category: 'FELLOWSHIP EVENTS',
        defaultOgImage: configuredDefaultOgImage,
        isFallback: true,
        siteUrl: cleanBase
      };
    }
  }

  // 4. Sermons (/sermons, /sermons/:id)
  else if (firstSeg === 'sermons' || firstSeg === 'sermon') {
    title = `Sermons & Bible Messages | Shalom Youth Fellowship`;
    description = `Listen to empowering sermons, gospel teaching, and biblical messages preached at Shalom Youth Fellowship.`;

    ogImageOptions = {
      pageType: 'sermon',
      title: 'Sermons & Scripture Messages',
      subtitle: 'Shalom Youth Fellowship - JSAG Aizawl',
      description: 'Gospel teaching, biblical messages, and faith inspiration for young believers.',
      category: 'SERMON ARCHIVE',
      siteUrl: cleanBase
    };
  }

  // 5. Departments (/departments, /departments/:id)
  else if (firstSeg === 'departments' || firstSeg === 'department') {
    const deptMap: Record<string, { title: string; desc: string; cat: string }> = {
      'youth': { title: 'Youth Fellowship', desc: 'Connecting young believers, organizing worship and Bible studies.', cat: 'YOUTH DEPARTMENT' },
      'sunday-school': { title: 'Sunday School Department', desc: 'Discipling young minds and teaching the Word of God.', cat: 'SUNDAY SCHOOL' },
      'choir': { title: 'Shalom Youth Choir', desc: 'Leading congregation in praise, worship, and choral music.', cat: 'CHOIR & MUSIC' },
      'womens-fellowship': { title: 'Women\'s Fellowship (Pavlai)', desc: 'Empowering women in faith, prayer, and family grace.', cat: 'WOMEN\'S FELLOWSHIP' },
      'mens-fellowship': { title: 'Men\'s Fellowship', desc: 'Building strong men of God through leadership and scripture.', cat: 'MEN\'S FELLOWSHIP' },
      'children': { title: 'Children\'s Ministry', desc: 'Nurturing children in biblical truth and joy.', cat: 'CHILDREN MINISTRY' },
      'evangelism': { title: 'Evangelism & Outreach', desc: 'Spreading the Gospel of Jesus Christ across communities.', cat: 'EVANGELISM & MISSION' },
      'bible-college': { title: 'Bible & Training Institute', desc: 'Equipping saints with foundational biblical doctrine.', cat: 'BIBLE INSTITUTE' }
    };

    const deptKey = (secondSeg || '').toLowerCase().replace(/\s+/g, '-');
    const matched = deptMap[deptKey] || {
      title: secondSeg ? `${secondSeg.toUpperCase().replace(/-/g, ' ')} Department` : 'Church Departments',
      desc: 'Discover ministries and fellowship departments at Shalom Youth, Assembly of God Church.',
      cat: 'CHURCH DEPARTMENT'
    };

    title = `${matched.title} | Shalom Youth Fellowship`;
    description = matched.desc;

    ogImageOptions = {
      pageType: 'department',
      title: matched.title,
      subtitle: 'Mizoram Assemblies of God Church • JSAG',
      description: matched.desc,
      category: matched.cat,
      siteUrl: cleanBase
    };
  }

  // 6. News & Articles (/news, /news/:id, /articles, /articles/:id, /announcements)
  else if (firstSeg === 'news' || firstSeg === 'articles' || firstSeg === 'article' || firstSeg === 'announcements') {
    title = `News & Announcements | Shalom Youth Fellowship`;
    description = `Latest updates, ministry news, testimonies, and announcements from Shalom Youth Fellowship, JSAG.`;

    ogImageOptions = {
      pageType: 'news',
      title: 'Shalom Youth News & Updates',
      subtitle: 'Official Church Announcements',
      description: 'Stay connected with news, fellowship announcements, and ministry stories.',
      category: 'NEWS & ANNOUNCEMENTS',
      siteUrl: cleanBase
    };
  }

  // 7. Prayer Requests (/prayers, /prayer-requests)
  else if (firstSeg === 'prayers' || firstSeg === 'prayer-requests' || firstSeg === 'prayer') {
    let prayerCount = 0;
    try {
      const { count } = await supabase.from('prayer_requests').select('*', { count: 'exact', head: true });
      if (count) prayerCount = count;
    } catch (err) {}

    title = `Prayer Requests & Intercession | Shalom Youth`;
    description = `Submit prayer requests and join in united intercession with Shalom Youth Fellowship believers (${prayerCount ? prayerCount + ' active requests' : 'active fellowship prayer'}).`;

    ogImageOptions = {
      pageType: 'prayer',
      title: 'Prayer Requests & Intercession',
      subtitle: 'Standing Together in Faith & Prayer',
      description: 'Send your prayer requests and join brethren in interceding for needs and healing.',
      category: 'PRAYER FELLOWSHIP',
      siteUrl: cleanBase
    };
  }

  // 8. Football & Sports (/football, /sports)
  else if (firstSeg === 'football' || firstSeg === 'sports') {
    title = `Shalom Football League | JSAG Youth Sports`;
    description = `Live football match fixtures, standings, predictions, top scorers, and team stats for Shalom Youth Football League.`;

    ogImageOptions = {
      pageType: 'football',
      title: 'Shalom Youth Football League',
      subtitle: 'Live Fixtures, Standings, & Predictions',
      description: 'Celebrating fellowship, teamwork, and athletic excellence through football.',
      category: 'SHALOM FOOTBALL LEAGUE',
      siteUrl: cleanBase
    };
  }

  // Construct OG Image URL for this page
  let ogImageEndpointPath = '/api/og';
  if (firstSeg === 'profile' && secondSeg) {
    ogImageEndpointPath = `/api/og/profile/${encodeURIComponent(secondSeg)}`;
  } else if ((firstSeg === 'services' || firstSeg === 'service' || firstSeg === 'schedules') && secondSeg) {
    ogImageEndpointPath = `/api/og/service/${encodeURIComponent(secondSeg)}`;
  } else if ((firstSeg === 'events' || firstSeg === 'event') && secondSeg) {
    ogImageEndpointPath = `/api/og/event/${encodeURIComponent(secondSeg)}`;
  } else if ((firstSeg === 'departments' || firstSeg === 'department') && secondSeg) {
    ogImageEndpointPath = `/api/og/department/${encodeURIComponent(secondSeg)}`;
  } else if (firstSeg) {
    ogImageEndpointPath = `/api/og/${encodeURIComponent(firstSeg)}${secondSeg ? '/' + encodeURIComponent(secondSeg) : ''}`;
  }

  const ogImageUrl = `${cleanBase}${ogImageEndpointPath}`;

  return {
    title,
    description,
    keywords,
    canonicalUrl,
    ogType,
    ogImage: ogImageUrl,
    ogImageSecure: ogImageUrl,
    siteUrl: cleanBase,
    ogImageOptions
  };
}
