'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import Script from 'next/script'

interface Hospital {
  id: number
  name: string
  address: string
  city: string
  state: string
  district: string
  pincode: string
  lat: number | null
  lng: number | null
  category: string[]
  careType: string
  discipline: string
  ownership: string
  beds: number
  emergency: boolean
  phones: string[]
  specialties: string
  facilities: string
}

interface ChatMessage {
  role: 'user' | 'ai'
  text: string
  hospitals?: Hospital[]
  source?: string
  webResults?: string
}

interface Specialty {
  name: string
  count: number
}

const CATEGORY_ICONS: Record<string, string> = {
  general: 'fa-hospital', cardiac: 'fa-heart-pulse', pediatric: 'fa-baby',
  orthopedic: 'fa-bone', neuro: 'fa-brain', oncology: 'fa-ribbon',
  trauma: 'fa-truck-medical', maternity: 'fa-person-pregnant', eye: 'fa-eye',
  dental: 'fa-tooth', ent: 'fa-ear-listen', ayurveda: 'fa-leaf',
  mental: 'fa-comments', transplant: 'fa-hand-holding-medical', rehab: 'fa-person-walking',
  diagnostic: 'fa-flask', phc: 'fa-house-medical', clinic: 'fa-stethoscope',
}

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-blue-100 text-blue-700', cardiac: 'bg-red-100 text-red-700',
  pediatric: 'bg-amber-100 text-amber-700', orthopedic: 'bg-purple-100 text-purple-700',
  neuro: 'bg-emerald-100 text-emerald-700', oncology: 'bg-pink-100 text-pink-700',
  trauma: 'bg-orange-100 text-orange-700', maternity: 'bg-rose-100 text-rose-700',
  eye: 'bg-cyan-100 text-cyan-700', dental: 'bg-teal-100 text-teal-700',
  ent: 'bg-indigo-100 text-indigo-700', ayurveda: 'bg-green-100 text-green-700',
  mental: 'bg-violet-100 text-violet-700', transplant: 'bg-lime-100 text-lime-700',
  rehab: 'bg-sky-100 text-sky-700', diagnostic: 'bg-slate-100 text-slate-700',
  phc: 'bg-yellow-100 text-yellow-700', clinic: 'bg-gray-100 text-gray-700',
}

const AI_SUGGESTIONS = [
  { icon: 'fa-heart-pulse', text: 'Best cardiac hospitals in Mumbai', color: 'text-red-500' },
  { icon: 'fa-brain', text: 'Neuro hospitals near Delhi', color: 'text-purple-500' },
  { icon: 'fa-baby', text: 'Pediatric care in Bangalore', color: 'text-amber-500' },
  { icon: 'fa-ribbon', text: 'Top cancer hospitals in India', color: 'text-pink-500' },
  { icon: 'fa-truck-medical', text: '24/7 emergency hospitals near me', color: 'text-orange-500' },
  { icon: 'fa-building-columns', text: 'Government hospitals in Tamil Nadu', color: 'text-green-500' },
]

export default function HomePage() {
  const [hospitals, setHospitals] = useState<Hospital[]>([])
  const [filteredHospitals, setFilteredHospitals] = useState<Hospital[]>([])
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [selectedState, setSelectedState] = useState('')
  const [selectedOwnership, setSelectedOwnership] = useState('all')
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null)
  const [stats, setStats] = useState({ total: 0, withCoords: 0, withEmergency: 0, states: [] as string[], categories: [] as string[] })
  const [loading, setLoading] = useState(true)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [specialties, setSpecialties] = useState<Specialty[]>([])
  const [specialtySearch, setSpecialtySearch] = useState('')
  const [showSpecialtyPicker, setShowSpecialtyPicker] = useState(false)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [displayedText, setDisplayedText] = useState('')

  const mapRef = useRef<L.Map | null>(null)
  const markersRef = useRef<L.Marker[]>([])
  const userMarkerRef = useRef<L.Marker | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const specialtyPickerRef = useRef<HTMLDivElement>(null)

  // Load stats on mount
  useEffect(() => {
    fetch('/api/hospitals/stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(console.error)
  }, [])

  // Load specialties from pre-generated static file (much faster than API)
  useEffect(() => {
    fetch('/specialties.json')
      .then(r => r.json())
      .then(data => setSpecialties(data.specialties || []))
      .catch(console.error)
  }, [])

  // Search hospitals
  const searchHospitals = useCallback(async (q?: string, cat?: string, state?: string, own?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const query = q ?? search
      const category = cat ?? selectedCategory
      const st = state ?? selectedState
      const ownership = own ?? selectedOwnership
      
      if (query) params.set('q', query)
      if (category && category !== 'all') params.set('category', category)
      if (st) params.set('state', st)
      if (ownership && ownership !== 'all') params.set('ownership', ownership)
      if (category === 'all' && !query && !st) {
        params.set('hasCoords', 'true')
        params.set('limit', '500')
      } else {
        params.set('limit', '200')
      }

      const res = await fetch(`/api/hospitals?${params}`)
      const data = await res.json()
      setFilteredHospitals(data.hospitals || [])
    } catch (err) {
      console.error('Search error:', err)
    }
    setLoading(false)
  }, [search, selectedCategory, selectedState, selectedOwnership])

  useEffect(() => {
    const timer = setTimeout(() => searchHospitals(), 500)
    return () => clearTimeout(timer)
  }, [search, selectedCategory, selectedState, selectedOwnership, searchHospitals])

  // Initialize Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return
    const L = (window as unknown as { L: typeof L }).L
    if (!L) return

    const map = L.map(mapContainerRef.current, {
      center: [22.5, 79.0],
      zoom: 5,
      minZoom: 4,
      maxZoom: 18,
      zoomControl: true,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    mapRef.current = map
  }, [])

  // Update map markers
  useEffect(() => {
    const L = (window as unknown as { L: typeof L }).L
    if (!mapRef.current || !L) return

    markersRef.current.forEach(m => mapRef.current?.removeLayer(m))
    markersRef.current = []

    const withCoords = filteredHospitals.filter(h => h.lat && h.lng)
    withCoords.forEach(h => {
      const isActive = selectedHospital?.id === h.id
      const icon = L.divIcon({
        html: `<div class="hospital-marker ${isActive ? 'active' : ''}"><i class="fa-solid fa-hospital"></i></div>`,
        className: '',
        iconSize: [isActive ? 34 : 28, isActive ? 34 : 28],
        iconAnchor: [isActive ? 17 : 14, isActive ? 34 : 28],
      })
      const marker = L.marker([h.lat!, h.lng!], { icon })
        .addTo(mapRef.current!)
        .on('click', () => {
          setSelectedHospital(h)
          setShowDetail(true)
        })
      marker.bindTooltip(h.name, { direction: 'top', offset: [0, -28] })
      markersRef.current.push(marker)
    })

    if (withCoords.length > 1) {
      const bounds = L.latLngBounds(withCoords.map(h => [h.lat!, h.lng!]))
      mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 })
    } else if (withCoords.length === 1) {
      mapRef.current.setView([withCoords[0].lat!, withCoords[0].lng!], 12)
    }
  }, [filteredHospitals, selectedHospital])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  // Typing animation for AI
  useEffect(() => {
    if (!isAiTyping) return
    const lastAi = chatMessages[chatMessages.length - 1]
    if (!lastAi || lastAi.role !== 'ai') { setIsAiTyping(false); return }
    
    const target = lastAi.text
    let idx = 0
    setDisplayedText('')
    const interval = setInterval(() => {
      idx += 2
      if (idx >= target.length) {
        setDisplayedText(target)
        setIsAiTyping(false)
        clearInterval(interval)
      } else {
        setDisplayedText(target.slice(0, idx))
      }
    }, 8)
    return () => clearInterval(interval)
  }, [isAiTyping, chatMessages.length])

  // AI Chat
  const sendChatMessage = async (overrideMsg?: string) => {
    const userMsg = (overrideMsg || chatInput).trim()
    if (!userMsg || chatLoading) return
    if (!overrideMsg) setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setChatLoading(true)
    setIsAiTyping(false)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 25000) // 25s client timeout
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: userMsg }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      const data = await res.json()
      const aiMsg: ChatMessage = {
        role: 'ai',
        text: data.response || 'Sorry, I could not process your request.',
        hospitals: data.hospitals || [],
        source: data.source,
        webResults: data.webResults,
      }
      setChatMessages(prev => [...prev, aiMsg])
      setIsAiTyping(true)
      if (data.hospitals?.length > 0) {
        setFilteredHospitals(data.hospitals)
      }
    } catch {
      setChatMessages(prev => [...prev, { role: 'ai', text: 'Something went wrong. Please try again.' }])
    }
    setChatLoading(false)
  }

  // Navigate to hospital from AI results
  const navigateToHospital = (h: Hospital) => {
    setSelectedHospital(h)
    setShowDetail(true)
    if (h.lat && h.lng && mapRef.current) {
      mapRef.current.setView([h.lat, h.lng], 14)
    }
  }

  // Close specialty picker on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (specialtyPickerRef.current && !specialtyPickerRef.current.contains(e.target as Node)) {
        setShowSpecialtyPicker(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filteredSpecialties = specialties.filter(s =>
    s.name.toLowerCase().includes(specialtySearch.toLowerCase())
  )

  // Render AI message text with markdown-like bold
  const renderAiText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-blue-800">{part.slice(2, -2)}</strong>
      }
      return <span key={i}>{part}</span>
    })
  }

  return (
    <>
      <Script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" strategy="beforeInteractive" />
      <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
        {/* Header */}
        <header className="relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #0052CC 0%, #003D99 100%)' }}>
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full" style={{ background: 'radial-gradient(circle, rgba(0,198,255,0.4) 0%, transparent 70%)', transform: 'translate(30%, -50%)' }} />
          </div>
          <div className="max-w-[1480px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between relative z-10">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <i className="fa-solid fa-hospital text-white text-sm" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">MedGenome <span style={{ color: '#00C6FF' }}>Hospital Finder</span></h1>
                <p className="text-[10px] sm:text-xs text-blue-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>PAN India — {stats.total.toLocaleString()} Hospitals</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="hidden md:flex items-center gap-4 text-[10px] text-blue-200" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                <span><span className="font-bold text-white">{stats.total.toLocaleString()}</span> HOSPITALS</span>
                <span><span className="font-bold text-white">{stats.states.length}</span> STATES</span>
                <span><span className="font-bold text-white">{specialties.length.toLocaleString()}</span> SPECIALTIES</span>
              </div>
              <button 
                onClick={() => { setShowChat(!showChat); if (!showChat) setTimeout(() => chatInputRef.current?.focus(), 100) }} 
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-lg"
                style={{ background: 'linear-gradient(135deg, rgba(0,198,255,0.3) 0%, rgba(0,198,255,0.1) 100%)', border: '1.5px solid rgba(0,198,255,0.4)', color: '#fff' }}
              >
                <i className="fa-solid fa-sparkles" />
                <span className="hidden sm:inline">AI Search</span>
              </button>
            </div>
          </div>
        </header>

        {/* Search & Filters */}
        <div className="bg-white border-b" style={{ borderColor: '#E2E8F0' }}>
          <div className="max-w-[1480px] mx-auto px-4 sm:px-6 py-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
                <input
                  type="text"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  placeholder="Search hospitals by name, city, state, specialty..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <select
                className="px-3 py-2.5 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={selectedState}
                onChange={e => setSelectedState(e.target.value)}
              >
                <option value="">All States</option>
                {stats.states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                className="hidden sm:block px-3 py-2.5 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={selectedOwnership}
                onChange={e => setSelectedOwnership(e.target.value)}
              >
                <option value="all">All Types</option>
                <option value="Government">Government</option>
                <option value="Private">Private</option>
              </select>
              {/* Specialty Picker Button */}
              <div className="relative" ref={specialtyPickerRef}>
                <button
                  onClick={() => setShowSpecialtyPicker(!showSpecialtyPicker)}
                  className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-sm bg-white hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                >
                  <i className="fa-solid fa-stethoscope text-blue-500" />
                  <span className="hidden sm:inline">Specialties</span>
                  <span className="text-[10px] text-blue-500 font-semibold">{specialties.length}</span>
                </button>
                {showSpecialtyPicker && (
                  <div className="absolute top-full mt-1 right-0 w-80 max-h-96 bg-white rounded-xl shadow-2xl border z-50 overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
                    <div className="p-2 border-b" style={{ borderColor: '#E2E8F0' }}>
                      <div className="relative">
                        <i className="fa-solid fa-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs" />
                        <input
                          type="text"
                          className="w-full pl-8 pr-3 py-2 rounded-lg border text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                          placeholder="Search 2,576 specialties..."
                          value={specialtySearch}
                          onChange={e => setSpecialtySearch(e.target.value)}
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto max-h-72 p-1">
                      {filteredSpecialties.slice(0, 50).map((spec, i) => (
                        <button
                          key={i}
                          onClick={() => { setSearch(spec.name); setShowSpecialtyPicker(false) }}
                          className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <span className="text-gray-700">{spec.name}</span>
                          <span className="text-gray-400 ml-2 flex-shrink-0" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{spec.count}</span>
                        </button>
                      ))}
                      {filteredSpecialties.length > 50 && (
                        <p className="text-center text-[10px] text-gray-400 py-2">Showing top 50 of {filteredSpecialties.length} — type to narrow down</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-1.5 mt-2.5 overflow-x-auto pb-1">
              <button onClick={() => setSelectedCategory('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${selectedCategory === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                All
              </button>
              {stats.categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1 ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <i className={`fa-solid ${CATEGORY_ICONS[cat] || 'fa-tag'}`} />
                  <span className="hidden sm:inline">{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 max-w-[1480px] mx-auto w-full px-4 sm:px-6 py-4">
          <div className="grid gap-4" style={{ gridTemplateColumns: '360px 1fr', height: 'calc(100vh - 200px)', minHeight: '400px' }}>
            
            {/* Results List */}
            <div className="flex flex-col rounded-xl border bg-white overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
              <div className="px-4 py-2.5 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0' }}>
                <span className="text-xs font-semibold text-gray-500" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  RESULTS <span className="text-blue-600">{filteredHospitals.length}</span>
                </span>
                <span className="text-xs text-gray-400">{loading ? 'Searching...' : ''}</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredHospitals.length === 0 && !loading ? (
                  <div className="text-center py-12 text-gray-400">
                    <i className="fa-solid fa-magnifying-glass text-2xl mb-3 block" />
                    <p className="text-sm">No hospitals found</p>
                    <p className="text-xs mt-1">Try adjusting your search or filters</p>
                  </div>
                ) : (
                  <div className="p-2 space-y-1.5">
                    {filteredHospitals.slice(0, 100).map(h => (
                      <div
                        key={h.id}
                        onClick={() => { setSelectedHospital(h); setShowDetail(true) }}
                        className={`p-3 rounded-lg cursor-pointer transition-all hover:shadow-md border ${selectedHospital?.id === h.id ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{h.name}</h3>
                          {h.category[0] && (
                            <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLORS[h.category[0]] || 'bg-gray-100 text-gray-600'}`}>
                              {h.category[0]}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-gray-500">
                          <i className="fa-solid fa-location-dot text-blue-500" />
                          <span>{h.city || h.district}, {h.state}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {h.ownership && h.ownership !== 'Unknown' && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${h.ownership === 'Government' ? 'bg-green-50 text-green-700' : 'bg-purple-50 text-purple-700'}`}>
                              {h.ownership}
                            </span>
                          )}
                          {h.emergency && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-600">
                              <i className="fa-solid fa-kit-medical mr-0.5" />24/7 ER
                            </span>
                          )}
                          {h.beds > 0 && (
                            <span className="text-[10px] text-gray-400">
                              <i className="fa-solid fa-bed mr-0.5" />{h.beds} beds
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {filteredHospitals.length > 100 && (
                      <p className="text-center text-xs text-gray-400 py-2">Showing top 100 of {filteredHospitals.length}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Map */}
            <div className="relative rounded-xl border overflow-hidden" style={{ borderColor: '#E2E8F0' }}>
              <div ref={mapContainerRef} className="w-full h-full" style={{ minHeight: '400px' }} />
              <div className="absolute top-3 left-3 z-[500] p-2.5 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm border" style={{ borderColor: '#E2E8F0' }}>
                <div className="flex gap-4">
                  <div>
                    <div className="text-lg font-bold text-blue-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {filteredHospitals.filter(h => h.lat && h.lng).length}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>ON MAP</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-blue-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      {stats.total.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-gray-400 font-medium" style={{ fontFamily: "'JetBrains Mono', monospace" }}>TOTAL</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* ============ AI SEARCH PANEL - Floating Overlay ============ */}
        {showChat && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowChat(false)} />
            
            {/* AI Panel */}
            <div className="relative w-full max-w-2xl h-[85vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col" style={{ border: '1px solid rgba(0,82,204,0.15)' }}>
              {/* AI Header */}
              <div className="px-5 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0052CC 0%, #003D99 100%)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(0,198,255,0.4) 0%, rgba(0,198,255,0.1) 100%)', border: '1px solid rgba(0,198,255,0.3)' }}>
                    <i className="fa-solid fa-sparkles text-white text-sm" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">MedGenome AI</h2>
                    <p className="text-[10px] text-blue-200">Smart Hospital Search across 30,000+ hospitals</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => { setChatMessages([]); setIsAiTyping(false) }}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                    title="Clear conversation"
                  >
                    <i className="fa-solid fa-trash-can text-blue-200 text-xs" />
                  </button>
                  <button 
                    onClick={() => setShowChat(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <i className="fa-solid fa-xmark text-white" />
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {chatMessages.length === 0 && !chatLoading && (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #E8F0FE 0%, #F0F7FF 100%)' }}>
                      <i className="fa-solid fa-sparkles text-2xl" style={{ color: '#0052CC' }} />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">How can I help you find hospitals?</h3>
                    <p className="text-sm text-gray-500 mb-6 max-w-xs">Search by specialty, city, condition, or any natural language query</p>
                    
                    {/* Suggestion Chips */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                      {AI_SUGGESTIONS.map((sug, i) => (
                        <button
                          key={i}
                          onClick={() => sendChatMessage(sug.text)}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl border text-left hover:shadow-md hover:border-blue-200 transition-all group"
                          style={{ borderColor: '#E2E8F0' }}
                        >
                          <i className={`fa-solid ${sug.icon} ${sug.color} text-sm group-hover:scale-110 transition-transform`} />
                          <span className="text-xs text-gray-700 group-hover:text-blue-700 transition-colors">{sug.text}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {chatMessages.map((msg, i) => {
                  const isLast = i === chatMessages.length - 1
                  const showTyping = isLast && msg.role === 'ai' && isAiTyping
                  
                  return (
                    <div key={i} className={`${msg.role === 'user' ? 'flex justify-end' : ''}`}>
                      {msg.role === 'ai' && (
                        <div className="flex gap-3">
                          <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center mt-1" style={{ background: '#E8F0FE' }}>
                            <i className="fa-solid fa-sparkles text-[10px]" style={{ color: '#0052CC' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="rounded-2xl rounded-tl-md px-4 py-3" style={{ background: 'linear-gradient(135deg, #F0F7FF 0%, #E8F0FE 100%)' }}>
                              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {showTyping ? renderAiText(displayedText) : renderAiText(msg.text)}
                                {showTyping && <span className="inline-block w-0.5 h-4 bg-blue-500 ml-0.5 animate-pulse" />}
                              </div>
                            </div>
                            {/* Source badge */}
                            {msg.source && (
                              <div className="flex items-center gap-2 mt-1.5 px-1">
                                <span className="text-[10px] text-gray-400" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                  {msg.source === 'z-ai' ? 'AI + Directory' : 'Local Search'}
                                </span>
                                {msg.webResults && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-50 text-green-600 font-medium">
                                    <i className="fa-solid fa-globe mr-0.5" />Web
                                  </span>
                                )}
                              </div>
                            )}
                            {/* Hospital cards from AI */}
                            {msg.hospitals && msg.hospitals.length > 0 && (
                              <div className="mt-3 space-y-2">
                                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                  Matching Hospitals ({msg.hospitals.length})
                                </p>
                                {msg.hospitals.slice(0, 5).map((h, hi) => (
                                  <div
                                    key={hi}
                                    onClick={() => navigateToHospital(h)}
                                    className="flex items-center gap-3 p-2.5 rounded-xl border bg-white hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all group"
                                    style={{ borderColor: '#E2E8F0' }}
                                  >
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E8F0FE' }}>
                                      <i className={`fa-solid ${CATEGORY_ICONS[h.category?.[0]] || 'fa-hospital'} text-xs`} style={{ color: '#0052CC' }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className="text-xs font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">{h.name}</h4>
                                      <p className="text-[10px] text-gray-500">{h.city || h.district}, {h.state}</p>
                                    </div>
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                      {h.emergency && (
                                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-600">ER</span>
                                      )}
                                      <i className="fa-solid fa-chevron-right text-[8px] text-gray-300 group-hover:text-blue-400 transition-colors" />
                                    </div>
                                  </div>
                                ))}
                                {msg.hospitals.length > 5 && (
                                  <button
                                    onClick={() => {
                                      setFilteredHospitals(msg.hospitals || [])
                                      setShowChat(false)
                                    }}
                                    className="w-full py-2 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                                  >
                                    View all {msg.hospitals.length} hospitals on map
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      {msg.role === 'user' && (
                        <div className="max-w-[80%]">
                          <div className="rounded-2xl rounded-tr-md px-4 py-2.5 bg-blue-600 text-white text-sm">
                            {msg.text}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Loading indicator */}
                {chatLoading && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center" style={{ background: '#E8F0FE' }}>
                      <i className="fa-solid fa-sparkles text-[10px]" style={{ color: '#0052CC' }} />
                    </div>
                    <div className="rounded-2xl rounded-tl-md px-4 py-3" style={{ background: 'linear-gradient(135deg, #F0F7FF 0%, #E8F0FE 100%)' }}>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs text-blue-500">Searching hospitals...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <div className="px-5 py-4 border-t flex-shrink-0" style={{ borderColor: '#E2E8F0', background: '#FAFBFC' }}>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <input
                      ref={chatInputRef}
                      type="text"
                      className="w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 pr-12"
                      placeholder="Ask about hospitals, specialties, cities..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                      disabled={chatLoading}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-300" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                      ↵
                    </div>
                  </div>
                  <button
                    onClick={() => sendChatMessage()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{ background: chatLoading || !chatInput.trim() ? '#94A3B8' : 'linear-gradient(135deg, #0052CC 0%, #003D99 100%)' }}
                  >
                    <i className="fa-solid fa-arrow-up text-sm" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">
                  MedGenome AI searches 30,000+ hospitals and the web for results
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Detail Panel Overlay */}
        {showDetail && selectedHospital && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowDetail(false)} />
            <div className="relative w-full max-w-md bg-white shadow-xl overflow-y-auto">
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#E8F0FE' }}>
                      <i className="fa-solid fa-hospital text-blue-600 text-sm" />
                    </div>
                    <span className="text-[10px] font-semibold text-blue-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>HOSPITAL DETAILS</span>
                  </div>
                  <button onClick={() => setShowDetail(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">
                    <i className="fa-solid fa-xmark text-gray-400" />
                  </button>
                </div>

                <h2 className="text-lg font-bold text-gray-900 mb-1">{selectedHospital.name}</h2>
                <div className="flex items-center gap-2 mb-4">
                  {selectedHospital.category.map((cat, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${CATEGORY_COLORS[cat] || 'bg-gray-100 text-gray-600'}`}>
                      {cat}
                    </span>
                  ))}
                  {selectedHospital.emergency && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-600">EMERGENCY</span>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="p-3 rounded-lg" style={{ background: '#E8F0FE' }}>
                    <div className="flex items-start gap-2">
                      <i className="fa-solid fa-location-dot text-blue-600 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{selectedHospital.address}</p>
                        <p className="text-sm text-gray-600">{selectedHospital.city || selectedHospital.district}, {selectedHospital.state}</p>
                        {selectedHospital.pincode && <p className="text-xs text-gray-400 mt-0.5">Pincode: {selectedHospital.pincode}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-3 rounded-lg bg-gray-50 text-center">
                      <div className="text-lg font-bold text-blue-600" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{selectedHospital.beds || 'N/A'}</div>
                      <div className="text-[10px] text-gray-400">Total Beds</div>
                    </div>
                    <div className="p-3 rounded-lg bg-gray-50 text-center">
                      <div className="text-lg font-bold text-gray-700" style={{ fontFamily: "'JetBrains Mono', monospace" }}>{selectedHospital.ownership}</div>
                      <div className="text-[10px] text-gray-400">Ownership</div>
                    </div>
                  </div>

                  {selectedHospital.specialties && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>SPECIALTIES</h4>
                      <p className="text-sm text-gray-700 leading-relaxed">{selectedHospital.specialties}</p>
                    </div>
                  )}

                  {selectedHospital.phones && selectedHospital.phones.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-500 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>CONTACT</h4>
                      {selectedHospital.phones.map((phone, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 mb-1">
                          <i className="fa-solid fa-phone text-blue-500 text-xs" />
                          <span className="text-sm text-gray-700">{phone}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {selectedHospital.lat && selectedHospital.lng && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedHospital.lat},${selectedHospital.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold text-white transition-colors hover:bg-blue-700"
                      style={{ background: '#0052CC' }}
                    >
                      <i className="fa-solid fa-diamond-turn-right" />
                      Get Directions on Google Maps
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="text-center py-3 text-xs text-gray-400 border-t" style={{ borderColor: '#E2E8F0' }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>MedGenome Hospitals</span> — PAN India Hospital Network Finder
        </footer>
      </div>
    </>
  )
}
