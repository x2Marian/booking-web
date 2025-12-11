// Booking web - calendar real, slot generation, deep-link intent
// Before publishing replace USER_GH and REPO with your GitHub username and repo name:
const USER_GH = "x2marian";
const REPO = "booking-web";
const WEB_BASE = `https://${USER_GH}.github.io/${REPO}`;

const services = [
  { id: 1, name: "Tuns + Finisaj", duration: 45 },
  { id: 2, name: "Tuns simplu", duration: 30 },
  { id: 3, name: "Barbierit", duration: 25 }
];

const specialists = [
  { id: 1, name: "Andrei", phone: "+40721234567", open: 9, close: 18 },
  { id: 2, name: "Mihai", phone: "+40729876543", open: 10, close: 17 }
];

// bookings persisted in localStorage for demo; shape: {serviceId, specialistId, dateISO, time, duration}
let bookings = JSON.parse(localStorage.getItem("bookings_v1") || "[]");

const weekdaysRo = ["Lu","Ma","Mi","Jo","Vi","Sa","Du"];
const monthFormatter = new Intl.DateTimeFormat("ro-RO", { month: "long", year: "numeric" });
const today = new Date();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth(); // 0-based
let selected = { service: null, specialist: null, dateISO: null, time: null };

// DOM
const $ = id => document.getElementById(id);
const servicesEl = $("services");
const specialistsEl = $("specialists");
const calendarEl = $("calendar");
const weekdaysEl = $("weekdays");
const monthLabel = $("monthLabel");
const prevBtn = $("prevMonth");
const nextBtn = $("nextMonth");
const timesEl = $("times");
const noTimesEl = $("noTimes");
const phoneEl = $("phone");
const nameEl = $("name");
const btnWhatsApp = $("btnWhatsApp");
const btnOpenApp = $("btnOpenApp");
const statusEl = $("status");

// render helpers
function createChip(text, cls="chip") {
  const d = document.createElement("div"); d.className = cls; d.textContent = text; return d;
}

function renderServices(){
  servicesEl.innerHTML = "";
  services.forEach(s=>{
    const el = createChip(`${s.name} (${s.duration} min)`);
    el.onclick = ()=>{
      document.querySelectorAll("#services .chip").forEach(x=>x.classList.remove("selected"));
      el.classList.add("selected");
      selected.service = s;
      renderTimes();
      updateButtons();
    };
    servicesEl.appendChild(el);
  });
}

function renderSpecialists(){
  specialistsEl.innerHTML = "";
  specialists.forEach(sp=>{
    const el = createChip(sp.name);
    el.onclick = ()=>{
      document.querySelectorAll("#specialists .chip").forEach(x=>x.classList.remove("selected"));
      el.classList.add("selected");
      selected.specialist = sp;
      renderTimes();
      updateButtons();
    };
    specialistsEl.appendChild(el);
  });
}

function buildWeekdays(){
  weekdaysEl.innerHTML = "";
  weekdaysRo.forEach(w=>{
    const t = document.createElement("div");
    t.className = "CalendarWeekDay";
    t.style.textAlign = "center";
    t.style.fontWeight = "600";
    t.style.padding = "6px 0";
    t.textContent = w;
    weekdaysEl.appendChild(t);
  });
}

function renderCalendar(){
  calendarEl.innerHTML = "";
  const first = new Date(viewYear, viewMonth, 1);
  const maxDay = new Date(viewYear, viewMonth+1, 0).getDate();
  // weekday index (Mon=0..Sun=6)
  const firstDow = (first.getDay() + 6) % 7; // convert Sun..Sat to Mon..Sun (0..6)
  monthLabel.textContent = monthFormatter.format(first).replace(/^\w/, c => c.toUpperCase());

  // pad before
  for(let i=0;i<firstDow;i++){
    const e = document.createElement("div"); e.className="day empty"; calendarEl.appendChild(e);
  }
  for(let d=1; d<=maxDay; d++){
    const date = new Date(viewYear, viewMonth, d);
    const iso = date.toISOString().slice(0,10);
    const el = document.createElement("div"); el.className="day"; el.textContent = String(d).padStart(2,'0');

    // past?
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    if(dayStart < new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate())){
      el.classList.add("past");
    }

    // today?
    const isToday = (date.getFullYear()===today.getFullYear() && date.getMonth()===today.getMonth() && date.getDate()===today.getDate());
    if(isToday) el.classList.add("today");

    el.onclick = ()=>{
      if(el.classList.contains("past")) return;
      document.querySelectorAll(".day").forEach(x=>x.classList.remove("selected"));
      el.classList.add("selected");
      selected.dateISO = iso;
      renderTimes();
      updateButtons();
    };

    calendarEl.appendChild(el);
    // if current date is default selected when month is current
    if(isToday && viewMonth===today.getMonth() && viewYear===today.getFullYear()){
      // auto-select today
      document.querySelectorAll(".day").forEach(x=>x.classList.remove("selected"));
      el.classList.add("selected");
      selected.dateISO = iso;
    }
  }
  renderTimes();
  updateButtons();
}

function getBookingsForDay(specId, dateISO){
  return bookings.filter(b => b.specialistId === specId && b.dateISO === dateISO);
}

function renderTimes(){
  timesEl.innerHTML = "";
  noTimesEl.style.display = "none";
  if(!selected.service || !selected.specialist || !selected.dateISO){
    noTimesEl.textContent = "Selectează serviciu, specialist și dată.";
    noTimesEl.style.display = "block";
    return;
  }
  const s = selected.service;
  const sp = selected.specialist;
  const dayBookings = getBookingsForDay(sp.id, selected.dateISO);
  const open = sp.open, close = sp.close;
  const step = 15;
  let any=false;

  for(let h=open; h<close; h++){
    for(let mm of [0,15,30,45]){
      const start = new Date(`${selected.dateISO}T${String(h).padStart(2,'0')}:${String(mm).padStart(2,'0')}:00`);
      const end = new Date(start.getTime() + s.duration*60000);
      // if exceeds closing hour
      if(end.getHours() > close || (end.getHours()===close && end.getMinutes()>0)) continue;

      const overlap = dayBookings.some(b=>{
        const bStart = new Date(`${b.dateISO}T${b.time}:00`);
        const bEnd = new Date(bStart.getTime() + b.duration*60000);
        return !(end <= bStart || start >= bEnd);
      });
      if(overlap) continue;

      any=true;
      const label = String(start.getHours()).padStart(2,'0') + ":" + String(start.getMinutes()).padStart(2,'0');
      const chip = createChip(label, "time");
      chip.onclick = ()=>{
        document.querySelectorAll("#times .time").forEach(x=>x.classList.remove("selected"));
        chip.classList.add("selected");
        selected.time = label;
        updateButtons();
      };
      timesEl.appendChild(chip);
    }
  }
  if(!any){
    noTimesEl.textContent = "Nu există ore libere pentru selecția curentă.";
    noTimesEl.style.display = "block";
  }
}

// phone validation
function isValidPhone(p){
  if(!p) return false;
  const d = p.replace(/\D/g,'');
  return d.length>=6;
}

function updateButtons(){
  const ready = selected.service && selected.specialist && selected.dateISO && selected.time && isValidPhone(phoneEl.value);
  btnWhatsApp.disabled = !ready;
  btnOpenApp.disabled = !ready;
}

// confirm send
btnWhatsApp.onclick = ()=>{
  const phone = phoneEl.value.trim();
  const name = nameEl.value.trim() || "Client";
  if(!isValidPhone(phone)){ statusEl.textContent="Număr invalid"; return; }
  // persist booking locally
  const booking = {
    serviceId: selected.service.id,
    specialistId: selected.specialist.id,
    dateISO: selected.dateISO,
    time: selected.time,
    duration: selected.service.duration,
    clientPhone: phone,
    clientName: name,
    createdAt: new Date().toISOString()
  };
  bookings.push(booking);
  localStorage.setItem("bookings_v1", JSON.stringify(bookings));
  // WhatsApp text
  const text = `Rezervare BarberSalon%0AClient: ${encodeURIComponent(name)}%0ATelefon: ${encodeURIComponent(phone)}%0AServiciu: ${encodeURIComponent(selected.service.name)}%0ASpecialist: ${encodeURIComponent(selected.specialist.name)}%0AData: ${encodeURIComponent(selected.dateISO)}%0AOra: ${encodeURIComponent(selected.time)}`;
  const wa = `https://wa.me/?text=${text}`;
  window.open(wa, "_blank");
  statusEl.textContent = "Trimis pe WhatsApp și salvat local.";
  updateButtons();
};

// open in app (intent URI)
btnOpenApp.onclick = ()=>{
  // build intent fallback to web page
  const qs = `service=${selected.service.id}&spec=${selected.specialist.id}&date=${selected.dateISO}&time=${selected.time}`;
  // intent://style with https scheme & fallback
  const intentUri = `intent://booking?${qs}#Intent;scheme=https;package=com.barber.barbersalon;S.browser_fallback_url=${encodeURIComponent(WEB_BASE)};end`;
  // navigate
  window.location.href = intentUri;
};

// month navigation
prevBtn.onclick = ()=>{
  viewMonth--;
  if(viewMonth<0){ viewMonth=11; viewYear--; }
  renderCalendar();
};
nextBtn.onclick = ()=>{
  viewMonth++;
  if(viewMonth>11){ viewMonth=0; viewYear++; }
  renderCalendar();
};

// init
function init(){
  buildWeekdays();
  renderServices();
  renderSpecialists();
  renderCalendar();
  // prefill phone if stored
  const storedPhone = localStorage.getItem("booking_phone_v1");
  if(storedPhone) phoneEl.value = storedPhone;
  // live validation
  phoneEl.addEventListener("input", ()=>{ localStorage.setItem("booking_phone_v1", phoneEl.value); updateButtons(); });
  nameEl.addEventListener("input", ()=>updateButtons());
}
init();
