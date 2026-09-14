import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Zap, Navigation, ListFilter, ExternalLink, LocateFixed, X, Building2, Globe, BellRing, ShieldCheck, Route as RouteIcon } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { FeedJob } from '../context/AppContext';
import { OPP_TYPES, oppTypeMeta, matchForOpportunity, apiSend } from '../lib/engine';
import { COMPANY_GEO, opportunityCoords, useUserLocation, haversineKm, formatDistance, directionsUrl, type GeoPoint } from '../lib/geo';
import { SectionTitle, Chip, Empty } from '../components/ui';

const RADII = [50, 150, 500, 2000];

export default function OpportunityMap() {
  const { opportunities, companies, mySkills, loading, feed, feedMeta, feedLoading } = useApp();
  const { isAuthed, authToken } = useAuth();
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const userLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const markerRef = useRef<Record<string, L.Marker>>({});
  const divRef = useRef<HTMLDivElement | null>(null);
  const [type, setType] = useState('all');
  const [urgency, setUrgency] = useState('all');
  const [selectedId, setSelectedId] = useState<string | number | null>(null);
  const [radiusKm, setRadiusKm] = useState(500);
  const [nearMeOnly, setNearMeOnly] = useState(false);
  const [includeRemote, setIncludeRemote] = useState(true);
  const [includeExternal, setIncludeExternal] = useState(true);
  const [showRoute, setShowRoute] = useState(false);
  const [manualCity, setManualCity] = useState('');
  const [alertsOn, setAlertsOn] = useState(false);
  const [alertMsg, setAlertMsg] = useState('');
  const [seenCount, setSeenCount] = useState(0);
  const [applyMsg, setApplyMsg] = useState('');
  const [applyingId, setApplyingId] = useState<string | number | null>(null);
  const geo = useUserLocation();
  const navigate = useNavigate();

  const companyOf = (id: number) => companies.find((c) => c.id === id);
  const { student, myApplications, refresh } = useApp();

  // In-map apply: uses the same authenticated applications API as the cards,
  // so the map popup apply button actually creates an application.
  const applyFromMap = useCallback(async (oppId: string | number, matchScore: number) => {
    setApplyMsg('');
    if (!isAuthed || !student) {
      navigate('/login');
      return;
    }
    const numId = Number(oppId);
    if (!Number.isFinite(numId)) return; // external rows use source links instead
    if (myApplications.some((a) => Number(a.opportunity_id) === numId)) {
      setApplyMsg('You already applied to this opportunity.');
      return;
    }
    setApplyingId(oppId);
    try {
      const token = await authToken();
      await apiSend('/api/applications', 'POST', {
        student_id: student.id, opportunity_id: numId, match_score: matchScore, cover_note: '',
      }, token);
      await refresh();
      setApplyMsg('✓ Applied! Track it under My Profile → Applications.');
    } catch (e) {
      setApplyMsg(e instanceof Error ? e.message : 'Application failed. Please try again.');
    } finally {
      setApplyingId(null);
    }
  }, [isAuthed, student, myApplications, authToken, refresh, navigate]);

  useEffect(() => {
    if (feed.length > 0 && seenCount === 0) setSeenCount(feed.length);
  }, [feed.length, seenCount]);
  const newSinceSeen = Math.max(0, feed.length - seenCount);
  useEffect(() => {
    if (!alertsOn || newSinceSeen <= 0) return;
    setAlertMsg(`🔔 ${newSinceSeen} new verified vacanc${newSinceSeen === 1 ? 'y' : 'ies'} just landed on the map.`);
    const t = setTimeout(() => setAlertMsg(''), 9000);
    return () => clearTimeout(t);
  }, [alertsOn, newSinceSeen]);

  const withDistance = useMemo(() => {
    const internal = opportunities
      .filter((o) => o.status === 'open')
      .map((o) => {
        const co = companyOf(o.company_id);
        const [lat, lng] = opportunityCoords(o, co?.location);
        let km: number | null = null;
        if (geo.coords && !o.remote) {
          km = haversineKm(geo.coords, { lat, lng });
        }
        return { o, co, lat, lng, km, feedJob: null as FeedJob | null };
      });
    const external = includeExternal
      ? feed.filter((j) => j.external).map((j) => {
          const [lat, lng] = opportunityCoords({ id: j.id, location: j.location, remote: j.remote, company_id: j.company_id }, undefined);
          let km: number | null = null;
          if (geo.coords && !j.remote) km = haversineKm(geo.coords, { lat, lng });
          const pseudo = {
            id: j.id, title: j.title, company_id: j.company_id, type: j.type, domain: j.domain,
            location: j.location, remote: j.remote, stipend: j.salary_text || j.stipend,
            stipend_num: 0, duration: j.duration, urgency: j.urgency, starts_in: j.starts_in,
            skills_required: j.skills || [], description: j.summary || '',
            openings: j.openings, applicants_count: j.applicants_count, status: j.status,
            posted_at: j.posted_text, deadline: 'See source listing', color: j.color,
            external: { source: j.source, source_url: j.source_url, verified: j.verified },
          } as unknown as (typeof opportunities)[number];
          return { o: pseudo, co: undefined, lat, lng, km, feedJob: j as FeedJob };
        })
      : [];
    return [...internal, ...external];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunities, companies, feed, includeExternal, geo.coords]);

  const filtered = useMemo(() => {
    return withDistance.filter(({ o, km }) => {
      if (type !== 'all' && o.type !== type) return false;
      if (urgency !== 'all' && o.urgency !== urgency) return false;
      if (!includeRemote && o.remote) return false;
      if (nearMeOnly) {
        if (!geo.coords) return true;
        if (o.remote) return true; // remote is available everywhere
        if (km == null || km > radiusKm) return false;
      }
      return true;
    }).sort((a, b) => {
      // Nearest on-site first when location is known; remote after
      if (geo.coords) {
        if (a.o.remote && !b.o.remote) return 1;
        if (!a.o.remote && b.o.remote) return -1;
        if (a.km != null && b.km != null) return a.km - b.km;
        if (a.km != null) return -1;
        if (b.km != null) return 1;
      }
      return String(b.o.id).localeCompare(String(a.o.id));
    });
  }, [withDistance, type, urgency, includeRemote, nearMeOnly, radiusKm, geo.coords]);

  const selected = useMemo(() => filtered.find((x) => String(x.o.id) === String(selectedId)) ?? null, [filtered, selectedId]);
  const selectedExternal = selected?.feedJob ?? null;

  // Init map once
  useEffect(() => {
    if (!divRef.current || mapRef.current) return;
    const map = L.map(divRef.current, { scrollWheelZoom: true }).setView([22.8, 79.5], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    userLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [filtered.length > 0]);

  // User location marker
  useEffect(() => {
    const map = mapRef.current;
    const layer = userLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (geo.coords) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="width:22px;height:22px;border-radius:9999px;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 6px #2563eb33, 0 4px 12px rgba(0,0,0,.35);"></div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      });
      L.marker([geo.coords.lat, geo.coords.lng], { icon, zIndexOffset: 1000 })
        .bindPopup(`<b>${geo.label || 'You are here'}</b>`)
        .addTo(layer);
    }
  }, [geo.coords, geo.label]);

  // Render job markers when data/filters change
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markerRef.current = {};
    const authed = isAuthed;
    const appliedIds = new Set(myApplications.map((a) => Number(a.opportunity_id)));
    const clusterRadius = 52;
    const renderMarkers = () => {
      layer.clearLayers();
      markerRef.current = {};
      const zoom = map.getZoom();
      const clusters: typeof filtered[number][][] = [];
      filtered.forEach((row) => {
        const point = map.project([row.lat, row.lng], zoom);
        const existing = clusters.find((cluster) => {
          const first = cluster[0];
          const firstPoint = map.project([first.lat, first.lng], zoom);
          return point.distanceTo(firstPoint) < clusterRadius;
        });
        if (existing) existing.push(row); else clusters.push([row]);
      });
      clusters.forEach((cluster) => {
        if (cluster.length > 1) {
          const lat = cluster.reduce((sum, row) => sum + row.lat, 0) / cluster.length;
          const lng = cluster.reduce((sum, row) => sum + row.lng, 0) / cluster.length;
          const topScore = Math.max(...cluster.map(({ o, feedJob }) => feedJob?.trust_score ?? matchForOpportunity(mySkills, o).score));
          const clusterIcon = L.divIcon({
            className: '',
            html: `<div style="display:grid;place-items:center;width:48px;height:48px;border-radius:50%;background:linear-gradient(145deg,#07382c,#0d7a5f);border:3px solid #fff;box-shadow:0 5px 16px rgba(7,56,44,.35);color:#fff;font:900 14px Inter,sans-serif;"><span>${cluster.length}</span><small style="display:block;font-size:9px;line-height:9px;opacity:.82;">jobs</small></div>`,
            iconSize: [48, 48],
            iconAnchor: [24, 24],
          });
          const clusterMarker = L.marker([lat, lng], { icon: clusterIcon, zIndexOffset: 500 });
          clusterMarker.bindTooltip(`${cluster.length} jobs · up to ${topScore}% trust/match`, { direction: 'top', offset: [0, -22] });
          if (cluster.length <= 2) {
            const clusterItems = cluster.map(({ o, lat: jobLat, lng: jobLng, feedJob }) => {
              const company = feedJob?.company_name ?? 'Verified employer';
              const directions = o.remote ? '' : geo.coords
                ? directionsUrl(geo.coords, { lat: jobLat, lng: jobLng })
                : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${o.location}, India`)}`;
              const directionLink = !o.remote
                ? `<a href="${directions}" target="_blank" rel="noreferrer" style="display:inline-block;margin-top:5px;background:#2563eb;color:#fff;border-radius:6px;padding:4px 7px;font-size:10px;font-weight:800;text-decoration:none;">Directions</a>`
                : '<span style="display:inline-block;margin-top:5px;color:#8a978f;font-size:10px;font-weight:700;">Remote</span>';
              return `<div data-cluster-job="${String(o.id)}" style="border-bottom:1px solid #e5dcc3;padding:8px 2px;color:#07382c;cursor:pointer;"><b style="display:block;font-size:12px;line-height:1.25;">${o.title.replace(/</g, '&lt;')}</b><span style="font-size:11px;color:#5a6a62;">${company.replace(/</g, '&lt;')}</span>${directionLink}</div>`;
            }).join('');
            clusterMarker.bindPopup(`<div style="min-width:210px;font-family:Inter,sans-serif;"><div style="font-weight:900;color:#07382c;font-size:13px;margin-bottom:3px;">${cluster.length} jobs at this location</div>${clusterItems}<div style="font-size:10px;color:#8a978f;margin-top:6px;">Select a job to view its details.</div></div>`);
            clusterMarker.on('popupopen', () => {
              const popup = clusterMarker.getPopup();
              const root = popup?.getElement();
              root?.querySelectorAll<HTMLElement>('[data-cluster-job]').forEach((button) => {
                button.onclick = (event) => {
                  if (event.target instanceof Element && event.target.closest('a')) return;
                  const id = button.dataset.clusterJob;
                  if (id) setSelectedId(id);
                  clusterMarker.closePopup();
                };
              });
            });
          } else {
            clusterMarker.on('click', () => map.flyTo([lat, lng], Math.min(17, zoom + 3), { duration: 0.6 }));
          }
          clusterMarker.addTo(layer);
          return;
        }
        const { o, co, lat, lng, km, feedJob } = cluster[0];
      const meta = oppTypeMeta(o.type);
      const pseudoSkills = (o.skills_required || []).map((s) => ({ skill_name: s, proficiency_pct: 60, verified: false })) as Parameters<typeof matchForOpportunity>[0];
      const match = matchForOpportunity(mySkills.length ? mySkills : pseudoSkills, o);
      const markerScore = feedJob?.trust_score ?? match.score;
      const markerScoreLabel = feedJob ? 'trust' : 'match';
      const instant = o.urgency === 'instant';
      const distLabel = o.remote ? 'Remote' : km != null ? formatDistance(km) : (o.location || 'On-site');
      const hq = COMPANY_GEO[o.company_id];
      const extBadge = feedJob ? `<span style="background:#0d7a5f;color:#fff;border-radius:9999px;padding:1px 7px;font-size:10px;font-weight:900;">✓ ${feedJob.source.toUpperCase()}</span>` : '';
      const destination = encodeURIComponent(`${o.location}, India`);
      const directionsLink = geo.coords
        ? directionsUrl(geo.coords, { lat, lng })
        : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
      const dirLink = !o.remote
        ? `<a href="${directionsLink}" target="_blank" rel="noreferrer" style="display:block;text-align:center;margin-top:6px;background:#2563eb;color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px;text-decoration:none;">🧭 ${geo.coords ? `Directions · ${distLabel}` : 'Get directions to this job'}</a>`
        : '';
      // Map popups live outside React, so the apply button dispatches a DOM
      // event the component listens for (fixes the dead popup button).
      const numId = Number(o.id);
      const already = Number.isFinite(numId) && appliedIds.has(numId);
      const applyBtn = feedJob
        ? `<a href="${feedJob.source_url}" target="_blank" rel="noreferrer" style="display:block;text-align:center;margin-top:8px;background:#0d7a5f;color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px;text-decoration:none;">Apply on ${feedJob.source} →</a>`
        : !Number.isFinite(numId)
          ? ''
          : already
            ? `<div style="display:block;text-align:center;margin-top:8px;background:#9db3a9;color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:7px;">✓ Applied</div>`
            : `<button data-apply-id="${numId}" data-match="${match.score}" style="display:block;width:100%;border:0;cursor:pointer;margin-top:8px;background:#0d7a5f;color:#fff;font-weight:800;font-size:12px;border-radius:8px;padding:8px;">${authed ? '⚡ Apply now' : 'Sign in to apply'} →</button>`;
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:34px;height:34px;">
          ${instant ? '<span style="position:absolute;inset:-6px;border-radius:9999px;background:#e8930c33;border:2px solid #e8930c88;"></span>' : ''}
          <div style="position:absolute;inset:0;display:grid;place-items:center;border-radius:12px;background:${meta.color};color:#fff;font-weight:900;font-size:13px;border:2px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,.3);">${instant ? '⚡' : (feedJob?.company_name ?? co?.name ?? o.title ?? 'J').charAt(0).toUpperCase()}</div>
          <div style="position:absolute;left:50%;bottom:-9px;transform:translateX(-50%);font-size:10px;font-weight:900;background:#07382c;color:#fff;border-radius:9999px;padding:0 6px;line-height:16px;white-space:nowrap;">${markerScore}%</div>
        </div>`,
        iconSize: [34, 44],
        iconAnchor: [17, 40],
        popupAnchor: [0, -38],
      });
      const m = L.marker([lat, lng], { icon });
      const esc = (s: string) => s.replace(/</g, '&lt;');
      m.bindPopup(`
        <div style="min-width:230px;max-width:270px;font-family:Inter,sans-serif;">
          <div style="font-size:10px;font-weight:800;letter-spacing:.08em;color:${meta.color};text-transform:uppercase;">${meta.label} ${instant ? '· ⚡ INSTANT' : ''} ${extBadge}</div>
          <div style="font-weight:800;color:#07382c;font-size:14px;line-height:1.3;margin:2px 0;">${esc(o.title)}</div>
          <div style="font-size:12px;color:#5a6a62;font-weight:600;">${esc(feedJob?.company_name ?? co?.name ?? 'Verified employer')} · ${o.remote ? 'Remote · work from anywhere' : `${esc(o.location)} · ${esc(distLabel)}`}</div>
          ${hq ? `<div style="font-size:11px;color:#8a978f;margin-top:2px;">HQ: ${esc(hq.hq)}</div>` : ''}
          <div style="display:flex;gap:6px;margin:6px 0;font-size:12px;font-weight:800;">
            <span style="color:#0d7a5f;">${esc(o.stipend)}</span><span style="color:#5a6a62;">· ${esc(o.duration)}</span>
          </div>
          <div style="font-size:12px;color:#3c4a44;">${markerScoreLabel === 'trust' ? 'Trust score' : 'Skill match'} <b>${markerScore}%</b> · ${esc((o.skills_required || []).slice(0, 3).join(', '))}</div>
          ${applyBtn}
          ${dirLink}
        </div>
      `);
      m.on('click', () => setSelectedId(o.id));
      m.addTo(layer);
      markerRef.current[String(o.id)] = m;
      });
    };
    renderMarkers();
    map.on('zoomend moveend', renderMarkers);
    if (filtered.length > 0) {
      if (geo.coords && nearMeOnly) {
        map.flyTo([geo.coords.lat, geo.coords.lng], 7, { duration: 0.8 });
      } else {
        const bounds = L.latLngBounds(filtered.map((x) => [x.lat, x.lng] as [number, number]));
        map.flyToBounds(bounds.pad(0.25), { duration: 0.8 });
      }
    }
    return () => { map.off('zoomend moveend', renderMarkers); };
  }, [filtered, mySkills, myApplications, isAuthed, geo.coords, nearMeOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  // Delegated listener for popup apply buttons (Leaflet popups are plain
  // DOM outside React, so onClick props never fire — this fixes that).
  useEffect(() => {
    const el = divRef.current;
    if (!el) return;
    const onClick = (e: Event) => {
      const t = (e.target as HTMLElement).closest?.('[data-apply-id]') as HTMLElement | null;
      if (!t) return;
      e.preventDefault();
      e.stopPropagation();
      void applyFromMap(t.dataset.applyId ?? '', Number(t.dataset.match ?? 60));
    };
    // Popups render in a Leaflet pane attached to the map container.
    const root = mapRef.current?.getContainer() ?? document;
    root.addEventListener('click', onClick);
    return () => root.removeEventListener('click', onClick);
  }, [applyFromMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Directions route: straight-line path from the user to the selected
  // on-site role, plus a Google Maps deep-link for turn-by-turn routing.
  useEffect(() => {
    const map = mapRef.current;
    const layer = routeLayerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (!showRoute || !geo.coords || !selected || selected.o.remote) return;
    const line = L.polyline(
      [[geo.coords.lat, geo.coords.lng], [selected.lat, selected.lng]],
      { color: '#2563eb', weight: 4, opacity: 0.85, dashArray: '10 8' },
    );
    line.addTo(layer);
    map.flyToBounds(line.getBounds().pad(0.3), { duration: 0.9 });
  }, [showRoute, geo.coords, selected]);

  useEffect(() => { setShowRoute(false); }, [selectedId, geo.coords]);

  const flyTo = (id: string | number) => {
    setSelectedId(id);
    const m = markerRef.current[String(id)];
    const map = mapRef.current;
    if (m && map) {
      map.flyTo(m.getLatLng(), 9, { duration: 0.9 });
      setTimeout(() => m.openPopup(), 950);
    }
  };

  const locateMe = () => {
    geo.request();
  };

  useEffect(() => {
    if (geo.coords && mapRef.current) {
      mapRef.current.flyTo([geo.coords.lat, geo.coords.lng], 8, { duration: 1 });
    }
  }, [geo.coords]);

  const instantCount = filtered.filter((x) => x.o.urgency === 'instant').length;
  const nearbyCount = geo.coords ? filtered.filter((x) => x.o.remote || (x.km != null && x.km <= radiusKm)).length : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <SectionTitle
        kicker="Live opportunity map · real employers"
        title="Jobs near you, from verified companies"
        sub="Pins sit on each employer's real HQ city across 40 verified partners — from solo clinics to FMCG majors and unicorns. Share your location to rank on-site roles by true distance — remote roles work from anywhere."
      />

      {/* Live sync status */}
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-[#e5dcc3] bg-white px-4 py-2.5 text-xs font-bold text-[#3c4a44] card-shadow">
        <span className="flex items-center gap-1.5">
          <span className={`inline-block h-2 w-2 rounded-full ${feedLoading ? 'bg-[#e8930c] pulse-dot' : 'bg-[#0d7a5f]'}`} />
          {feedLoading ? 'Syncing live vacancies…' : `Live · ${feedMeta?.count ?? filtered.length} verified vacancies · updated ${feedMeta?.updated_at ? new Date(feedMeta.updated_at).toLocaleTimeString() : 'just now'}`}
        </span>
        {feedMeta && (
          <span className="rounded-full bg-[#effaf4] px-2.5 py-1 text-[11px] font-black text-[#0d7a5f]">
            {feedMeta.internal_count} on-platform + {feedMeta.external_count} via verified boards
          </span>
        )}
        <button
          onClick={() => {
            const on = !alertsOn;
            setAlertsOn(on);
            if (on) { setSeenCount(feed.length); setAlertMsg('🔔 Live alerts on — new verified vacancies will pop up here within a minute.'); }
            else setAlertMsg('');
          }}
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-black transition ${alertsOn ? 'bg-[#07382c] text-white' : 'bg-[#f1e9d2] text-[#6b6250] hover:bg-[#e5dcc3]'}`}
        >
          <BellRing size={13} /> {alertsOn ? 'Alerts on' : 'Notify me'}
        </button>
      </div>
      {alertMsg && (
        <div className="tick mb-3 rounded-2xl bg-[#07382c] px-4 py-2.5 text-[13px] font-bold text-[#f5d48a]">
          {alertMsg}{' '}
          <button onClick={() => { setSeenCount(feed.length); setAlertMsg(''); }} className="ml-1 underline hover:text-white">Mark seen</button>
        </div>
      )}

      {/* Location bar — production-ready geolocation */}
      <div className="mb-3 rounded-2xl border border-[#e5dcc3] bg-white p-3 card-shadow">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          {!geo.coords ? (
            <>
              <button
                onClick={locateMe}
                disabled={geo.status === 'locating'}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1d4ed8] disabled:opacity-60"
              >
                <LocateFixed size={16} /> {geo.status === 'locating' ? 'Locating…' : '📍 Use my location'}
              </button>
              <div className="flex flex-1 items-center gap-2">
                <input
                  value={manualCity}
                  onChange={(e) => setManualCity(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') geo.setManualCity(manualCity); }}
                  placeholder="Or type your city (e.g. Nagpur, Jaipur, Kochi)…"
                  className="w-full rounded-xl border border-[#d8cdae] bg-[#fffdf6] px-3 py-2.5 text-sm outline-none focus:border-[#0d7a5f]"
                />
                <button
                  onClick={() => geo.setManualCity(manualCity)}
                  className="shrink-0 rounded-xl border-2 border-[#0d7a5f] px-4 py-2 text-sm font-bold text-[#0d7a5f] hover:bg-[#0d7a5f] hover:text-white"
                >
                  Set
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#effaf4] px-3 py-1.5 text-[13px] font-bold text-[#0d7a5f]">
                <MapPin size={14} /> {geo.label || 'Location set'} · {geo.status === 'manual' ? 'city centre' : `${geo.coords.lat.toFixed(2)}, ${geo.coords.lng.toFixed(2)}`}
              </span>
              <label className="flex items-center gap-1.5 rounded-xl bg-[#faf7ef] px-3 py-1.5 text-xs font-bold text-[#3c4a44]">
                Within
                <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} className="bg-transparent font-black text-[#07382c] outline-none">
                  {RADII.map((r) => <option key={r} value={r}>{r >= 2000 ? 'All India' : `${r} km`}</option>)}
                </select>
              </label>
              <button
                onClick={() => setNearMeOnly(!nearMeOnly)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${nearMeOnly ? 'bg-[#07382c] text-white' : 'bg-[#f1e9d2] text-[#6b6250] hover:bg-[#e5dcc3]'}`}
              >
                {nearMeOnly ? `✓ Near me first (${nearbyCount ?? 0})` : 'Sort: nearest first'}
              </button>
              <button onClick={() => { geo.clear(); setNearMeOnly(false); setManualCity(''); }} className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-[#8a978f] hover:text-[#dc2626]">
                <X size={13} /> Clear
              </button>
            </div>
          )}
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#3c4a44]">
            <input type="checkbox" checked={includeRemote} onChange={(e) => setIncludeRemote(e.target.checked)} className="h-4 w-4 accent-[#0d7a5f]" />
            Include remote
          </label>
          <label className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-[#3c4a44]" title="Verified listings from Naukri, LinkedIn, Internshala, Wellfound, Cutshort, NCS">
            <input type="checkbox" checked={includeExternal} onChange={(e) => setIncludeExternal(e.target.checked)} className="h-4 w-4 accent-[#0d7a5f]" />
            External boards
          </label>
        </div>
        {geo.error && <p className="mt-2 text-xs font-bold text-[#b45309]">{geo.error}</p>}
        {geo.status === 'denied' && (
          <p className="mt-1 text-xs text-[#5a6a62]">Tip: click the location icon in your browser's address bar → Allow → then press “Use my location” again.</p>
        )}
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-[#e5dcc3] bg-white p-3 card-shadow lg:flex-row lg:items-center">
        <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
          <button onClick={() => setType('all')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${type === 'all' ? 'bg-[#07382c] text-white' : 'bg-[#f1e9d2] text-[#6b6250]'}`}>
            All · {opportunities.filter((o) => o.status === 'open').length}
          </button>
          {OPP_TYPES.map((t) => (
            <button key={t.key} onClick={() => setType(t.key)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold ${type === t.key ? 'text-white' : 'bg-[#f1e9d2] text-[#6b6250]'}`}
              style={type === t.key ? { background: t.color } : {}}>
              {t.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 rounded-xl bg-[#faf7ef] px-3 py-1.5 text-xs font-bold text-[#3c4a44]">
          <ListFilter size={14} className="text-[#0d7a5f]" />
          <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="bg-transparent outline-none">
            <option value="all">Any speed</option>
            <option value="instant">⚡ Instant only</option>
            <option value="soon">Starting in days</option>
            <option value="flexible">Flexible</option>
          </select>
        </label>
        <span className="flex items-center gap-1.5 rounded-full bg-[#e8930c] px-3 py-1.5 text-xs font-black text-white">
          <span className="pulse-dot inline-block h-2 w-2 rounded-full bg-white" /> {instantCount} LIVE NOW
        </span>
      </div>

      {applyMsg && (
        <div className={`tick mb-3 rounded-2xl px-4 py-2.5 text-[13px] font-bold ${applyMsg.startsWith('✓') ? 'bg-[#0d7a5f] text-white' : 'bg-[#fef3c7] text-[#92400e]'}`}>
          {applyMsg}{' '}
          <button onClick={() => setApplyMsg('')} className="ml-1 underline opacity-80 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="h-[560px] rounded-2xl bg-white shimmer" />
      ) : filtered.length === 0 ? (
        <Empty
          title={nearMeOnly && geo.coords ? `No roles within ${radiusKm} km — try a wider radius` : 'No jobs on the map for these filters'}
          sub="Remote roles are available everywhere — enable 'Include remote' or widen the radius."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Map */}
          <div className="overflow-hidden rounded-2xl border border-[#e5dcc3] bg-white card-shadow lg:col-span-2">
            <div ref={divRef} className="h-[420px] w-full sm:h-[560px]" style={{ zIndex: 0 }} />
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#e5dcc3] px-4 py-2.5 text-[11px] font-bold text-[#5a6a62]">
              <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full bg-[#2563eb]" /> You</span>
              <span className="flex items-center gap-1"><MapPin size={12} className="text-[#0d7a5f]" /> Pins = real employer HQ cities · tap for details</span>
              {OPP_TYPES.map((t) => (
                <span key={t.key} className="flex items-center gap-1">
                  <span className="inline-block h-2.5 w-2.5 rounded" style={{ background: t.color }} /> {t.label}
                </span>
              ))}
              <Link to="/opportunities" className="ml-auto flex items-center gap-1 text-[#0d7a5f] hover:underline">
                List view <ExternalLink size={12} />
              </Link>
            </div>
          </div>

          {/* Side list */}
          <div className="flex max-h-[560px] flex-col rounded-2xl border border-[#e5dcc3] bg-white card-shadow">
            <p className="border-b border-[#e5dcc3] px-4 py-3 text-xs font-black uppercase tracking-widest text-[#0d7a5f]">
              <Navigation size={12} className="mr-1 inline" /> {filtered.length} jobs plotted{geo.coords ? ' · nearest first' : ''}
              {applyingId != null && <span className="ml-2 text-[#e8930c]">Applying…</span>}
            </p>
            <div className="grid flex-1 gap-2 overflow-y-auto p-3">
              {filtered.map(({ o, co, km, feedJob }) => {
                const meta = oppTypeMeta(o.type);
                const match = matchForOpportunity(mySkills, o);
                const listScore = feedJob?.trust_score ?? match.score;
                const active = String(selectedId) === String(o.id);
                const dist = o.remote ? 'Remote · anywhere' : km != null ? formatDistance(km) : o.location;
                return (
                  <button key={o.id} onClick={() => flyTo(o.id)}
                    className={`rounded-xl border-2 p-3 text-left transition ${active ? 'border-[#0d7a5f] bg-[#effaf4]' : 'border-[#ece2c8] bg-[#fffdf6] hover:border-[#0d7a5f]'}`}>
                    <div className="flex items-center gap-1.5">
                      <Chip color={meta.color}>{meta.label}</Chip>
                      {o.urgency === 'instant' && <Chip color="#e8930c"><Zap size={10} /> INSTANT</Chip>}
                      {feedJob && <Chip color="#0d7a5f"><ShieldCheck size={10} /> {feedJob.source}</Chip>}
                      <span className="ml-auto text-sm font-black" style={{ color: listScore >= 60 ? '#0d7a5f' : '#e8930c' }}>{listScore}%</span>
                    </div>
                    <p className="mt-1 text-[13px] font-bold leading-snug text-[#07382c]">{o.title}</p>
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-[#5a6a62]">
                      <Building2 size={11} className="shrink-0" /> {feedJob ? feedJob.company_name : co?.name} · {dist}
                    </p>
                    <p className="text-[11px] font-semibold text-[#8a978f]">{o.remote ? 'Work from home' : o.location} · {o.stipend} · {o.duration}</p>
                  </button>
                );
              })}
            </div>
            {selected && (() => {
              const meta = oppTypeMeta(selected.o.type);
              const match = matchForOpportunity(mySkills, selected.o);
              const hq = COMPANY_GEO[selected.o.company_id];
              const dist = selected.o.remote ? 'Remote — work from anywhere in India' : selected.km != null ? `${formatDistance(selected.km)} from you · ${selected.o.location}` : selected.o.location;
              const gmaps = !selected.o.remote
                ? geo.coords
                  ? directionsUrl(geo.coords, { lat: selected.lat, lng: selected.lng })
                  : `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${selected.o.location}, India`)}`
                : null;
              return (
                <div className="tick border-t-2 border-[#0d7a5f] bg-[#faf7ef] p-4 text-[13px]">
                  <p className="flex flex-wrap items-center gap-1.5 text-[11px] font-black uppercase tracking-widest" style={{ color: meta.color }}>
                    {meta.label} · {(selectedExternal?.trust_score ?? match.score)}% {selectedExternal ? 'trust score' : 'match for you'}
                    {selectedExternal && <span className="rounded-full bg-[#0d7a5f] px-2 py-0.5 text-[10px] text-white">✓ via {selectedExternal.source}</span>}
                  </p>
                  <p className="font-display text-[15px] font-bold text-[#07382c]">{selected.o.title}</p>
                  <p className="flex items-center gap-1 text-xs font-semibold text-[#5a6a62]"><Building2 size={12} /> {selectedExternal ? selectedExternal.company_name : selected.co?.name}{!selectedExternal && selected.co?.verified ? ' ✓ Verified' : ''}</p>
                  <p className="flex items-center gap-1 text-xs font-bold text-[#2563eb]"><MapPin size={12} /> {dist}</p>
                  {hq && (
                    <a href={hq.website} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-[#8a978f] hover:text-[#0d7a5f]">
                      <Globe size={11} /> HQ: {hq.hq} · {hq.website.replace('https://', '')} <ExternalLink size={10} />
                    </a>
                  )}
                  <p className="mt-1 line-clamp-2 text-[#3c4a44]">{selected.o.description}</p>
                  {selectedExternal && (
                    <a href={selectedExternal.source_url} target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#0d7a5f] px-3 py-2 text-xs font-black text-white hover:bg-[#0b6a52]">
                      Apply on {selectedExternal.source} <ExternalLink size={12} />
                    </a>
                  )}
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => flyTo(selected.o.id)} className="flex-1 rounded-lg border-2 border-[#0d7a5f] px-3 py-1.5 text-xs font-bold text-[#0d7a5f]">Locate pin</button>
                    {selectedExternal ? (
                      <a href={selectedExternal.source_url} target="_blank" rel="noreferrer" className="flex-1 rounded-lg bg-[#07382c] px-3 py-1.5 text-center text-xs font-bold text-white">Source listing →</a>
                    ) : myApplications.some((a) => Number(a.opportunity_id) === Number(selected.o.id)) ? (
                      <span className="flex-1 rounded-lg bg-[#9db3a9] px-3 py-1.5 text-center text-xs font-bold text-white">✓ Applied</span>
                    ) : (
                      <button
                        onClick={() => void applyFromMap(selected.o.id, match.score)}
                        disabled={applyingId != null}
                        className="flex-1 rounded-lg bg-[#0d7a5f] px-3 py-1.5 text-center text-xs font-bold text-white hover:bg-[#0b6a52] disabled:opacity-60"
                      >
                        {applyingId != null ? 'Applying…' : isAuthed ? '⚡ Apply now' : 'Sign in to apply'}
                      </button>
                    )}
                  </div>
                  {gmaps && (
                    <div className="mt-2 grid gap-2">
                      <button
                        onClick={() => setShowRoute(!showRoute)}
                        className={`flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-black transition ${showRoute ? 'bg-[#07382c] text-white' : 'bg-[#2563eb] text-white hover:bg-[#1d4ed8]'}`}
                      >
                        <RouteIcon size={13} /> {showRoute ? '✓ Route shown — hide' : '🧭 Show route from my location'}
                      </button>
                      {showRoute && (
                        <a href={gmaps} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-lg border-2 border-[#2563eb] px-3 py-1.5 text-xs font-black text-[#2563eb] hover:bg-[#2563eb] hover:text-white">
                          <Navigation size={13} /> Open turn-by-turn in Google Maps
                        </a>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
