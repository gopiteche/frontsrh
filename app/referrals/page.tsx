"use client";

import { useEffect, useMemo, useState } from "react";
import { GoogleMap, LoadScript, Marker } from "@react-google-maps/api";

interface District { _id: string; districtName: string; }
interface Executor { _id: string; executorName: string; district: District; }
interface Doctor {
  hospitalName: string;
  _id: string;
  doctorName: string;
  address: string;
  executor: Executor;
  count: { currentMonth: number; lastMonth: number; previous: number };
}

type Row = {
  doctorId: string;
  doctorName: string;
  hospitalName?: string;
  address: string;
  currentMonth: number;
  lastMonth: number;
  previous: number;
  status: "green" | "blue" | "red";
};

// const API_BASE = "http://54.146.28.151:5000/api";
// const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000/api";
const API_BASE = "http://54.90.5.134:5000/api";

export default function ReferralsPage() {
  const [districts, setDistricts] = useState<District[]>([]);
  const [executors, setExecutors] = useState<Executor[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);

  const [addressLatLng, setAddressLatLng] = useState<Record<string, { lat: number; lng: number }>>({});
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | undefined>(undefined);
  const [mapZoom, setMapZoom] = useState<number | undefined>(undefined);

  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [selectedExecutor, setSelectedExecutor] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("all");

  useEffect(() => {
    const fetchInitial = async () => {
      const dRes = await fetch(`${API_BASE}/district/list`).then(r => r.json());
      if (dRes.status) setDistricts(dRes.data);
      
      const eRes = await fetch(`${API_BASE}/executor/list`);
      const eData = await eRes.json();
      if (eData.status) setExecutors(eData.data);

      setLoading(false);
    };
    fetchInitial();
  }, []);

  const fetchExecutors = async (districtId: string) => {
    const query = districtId ? `?districtId=${districtId}` : "";
    const res = await fetch(`${API_BASE}/executor/search${query}`);
    const data = await res.json();
    if (data.status) setExecutors(data.data);
    else setExecutors([]);
  };

  const fetchDoctors = async () => {
    let query = "?";
    if (selectedDistrict) query += `districtId=${selectedDistrict}&`;
    if (selectedExecutor) query += `executorId=${selectedExecutor}&`;
    if (selectedMonth && selectedMonth !== "all") query += `month=${selectedMonth}&`;
    const res = await fetch(`${API_BASE}/doctor/search${query}`);
    const data = await res.json();
    if (data.status) setDoctors(data.data);
    else setDoctors([]);
  };

useEffect(() => {
  if (selectedDistrict) fetchExecutors(selectedDistrict);
  else {
    const fetchAllExecutors = async () => {
      const res = await fetch(`${API_BASE}/executor/list`);
      const data = await res.json();
      if (data.status) setExecutors(data.data);
      else setExecutors([]);
    };
    fetchAllExecutors();
  }
  setSelectedExecutor("");
}, [selectedDistrict]);


  useEffect(() => {
    fetchDoctors();
  }, [selectedDistrict, selectedExecutor, selectedMonth]);

  const getStatus = (
    c: { currentMonth: number; lastMonth: number; previous: number },
    month: string
  ): Row["status"] => {
    if (month === "current") return c.currentMonth > 0 ? "green" : "red";
    if (month === "last") return c.lastMonth > 0 ? "blue" : "red";
    if (month === "previous") return c.previous > 0 ? "red" : "red";
    if (c.currentMonth > 0) return "green";
    if (c.lastMonth > 0) return "blue";
    if (c.previous > 0) return "red";
    return "red";
  };

  const rows: Row[] = useMemo(() => {
    return doctors.map(d => {
      const c = d.count || { currentMonth: 0, lastMonth: 0, previous: 0 };
      return {
        doctorId: d._id,
        doctorName: d.doctorName,
        hospitalName: d.hospitalName,
        address: d.address,
        currentMonth: c.currentMonth,
        lastMonth: c.lastMonth,
        previous: c.previous,
        status: getStatus(c, selectedMonth)
      };
    });
  }, [doctors, selectedMonth]);

  useEffect(() => {
    const fetchGeocodes = async () => {
      const mapDoctors = rows.length > 0 ? rows : doctors.map(d => ({
        doctorId: d._id,
        doctorName: d.doctorName,
        hospitalName: d.hospitalName,
        address: d.address,
        currentMonth: d.count?.currentMonth || 0,
        lastMonth: d.count?.lastMonth || 0,
        previous: d.count?.previous || 0,
        status: getStatus(d.count || { currentMonth: 0, lastMonth: 0, previous: 0 }, selectedMonth)
      }));

      const newLatLng: Record<string, { lat: number; lng: number }> = { ...addressLatLng };

      await Promise.all(
        mapDoctors.map(async d => {
          if (!d.address || newLatLng[d.address]) return;
          const res = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
              d.address
            )}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAP_KEY}`
          );
          const data = await res.json();
          if (data.status === "OK" && data.results[0]) {
            newLatLng[d.address] = data.results[0].geometry.location;
          }
        })
      );

      setAddressLatLng(newLatLng);
    };

    if (doctors.length) fetchGeocodes();
  }, [rows, doctors, selectedMonth]);

  useEffect(() => {
    const mapDoctors = rows.length > 0 ? rows : doctors.map(d => ({
      doctorId: d._id,
      doctorName: d.doctorName,
      address: d.address,
      currentMonth: d.count?.currentMonth || 0,
      lastMonth: d.count?.lastMonth || 0,
      previous: d.count?.previous || 0,
      status: getStatus(d.count || { currentMonth: 0, lastMonth: 0, previous: 0 }, selectedMonth)
    }));

    const mapPoints = mapDoctors.map(d => addressLatLng[d.address]).filter(Boolean);
    if (!mapPoints.length) return;

    const lats = mapPoints.map(p => p.lat);
    const lngs = mapPoints.map(p => p.lng);
    const north = Math.max(...lats);
    const south = Math.min(...lats);
    const east = Math.max(...lngs);
    const west = Math.min(...lngs);

    setMapCenter({ lat: (north + south) / 2, lng: (east + west) / 2 });

    const latDiff = north - south;
    const lngDiff = east - west;
    const maxDiff = Math.max(latDiff, lngDiff);

    setMapZoom(maxDiff < 0.01 ? 20 : maxDiff < 0.1 ? 16 : maxDiff < 1 ? 10 : 7);
  }, [addressLatLng, rows, doctors, selectedMonth]);

  const getIcon = (status: Row["status"]) => ({
    url: `https://maps.google.com/mapfiles/ms/icons/${
      status === "green" ? "green" : status === "blue" ? "blue" : "red"
    }-dot.png`
  });

const handleExport = async () => {
  let query = "?";
  if (selectedDistrict) query += `districtId=${selectedDistrict}&`;
  if (selectedExecutor) query += `executorId=${selectedExecutor}&`;
  if (selectedMonth && selectedMonth !== "all") query += `month=${selectedMonth}&`;

  const res = await fetch(`${API_BASE}/doctor/export${query}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "doctors.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};


  if (loading) return <p className="p-6">Loading...</p>;

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="w-full max-w-7xl grid grid-cols-2 gap-2 items-start">

        <div className="col-span-2 flex gap-4 mb-2">
          <select className="px-2 py-1 border rounded-md" value={selectedDistrict} onChange={e => setSelectedDistrict(e.target.value)}>
            <option value="">All Districts</option>
            {districts.map(d => <option key={d._id} value={d._id}>{d.districtName}</option>)}
          </select>

          <select className="px-2 py-1 border rounded-md" value={selectedExecutor} onChange={e => setSelectedExecutor(e.target.value)}>
            <option value="">All Executors</option>
            {executors.map(e => <option key={e._id} value={e._id}>{e.executorName}</option>)}
          </select>

          <select className="px-2 py-1 border rounded-md" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
            <option value="all">All Months</option>
            <option value="current">Current Month</option>
            <option value="last">Last Month</option>
            <option value="previous">Previous</option>
          </select>

          <button onClick={handleExport} className="px-4 py-1 bg-blue-600 text-white rounded-md">Export</button>
        </div>

        <div className="bg-white shadow h-[600px] rounded-lg">
          <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAP_KEY as string}>
            {mapCenter && Object.keys(addressLatLng).length > 0 && (
              <GoogleMap mapContainerStyle={{ width: "100%", height: "100%" }} center={mapCenter} zoom={mapZoom}>
                {(rows.length > 0 ? rows : doctors.map(d => ({
                  doctorId: d._id,
                  doctorName: d.doctorName,
                  address: d.address,
                  currentMonth: d.count?.currentMonth || 0,
                  lastMonth: d.count?.lastMonth || 0,
                  previous: d.count?.previous || 0,
                  status: getStatus(d.count || { currentMonth: 0, lastMonth: 0, previous: 0 }, selectedMonth)
                }))).map(r => {
                  const pos = addressLatLng[r.address];
                  if (!pos) return null;
                  return <Marker key={r.doctorId} position={pos} icon={getIcon(r.status)} title={r.doctorName} />;
                })}
              </GoogleMap>
            )}

          </LoadScript>
        </div>

        <div className="bg-white shadow overflow-hidden h-[600px] flex flex-col rounded-lg">
          <div className="border-t-4 border-blue-600 bg-slate-200 px-3 py-2">
            <h2 className="text-center font-semibold text-sm">Doctor Referral Summary</h2>
          </div>

          <div className="flex-1 overflow-auto">
            {rows.length === 0 ? (
              <p className="text-center p-6 text-gray-500">No data available</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs">
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-left">Doctor</th>
                    <th className="px-3 py-2 text-center">Current</th>
                    <th className="px-3 py-2 text-center">Last</th>
                    <th className="px-3 py-2 text-center">Previous</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.doctorId || r.hospitalName} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="px-3 py-2 text-center">
                        <span className={`inline-block w-2.5 h-2.5 rounded-full ${
                          r.status === "green" ? "bg-green-500" :
                          r.status === "blue" ? "bg-blue-500" : "bg-red-500"
                        }`} />
                      </td>
                      <td className="px-3 py-2">{r.doctorName || r.hospitalName}</td>
                      <td className="px-3 py-2 text-center text-green-600">{r.currentMonth}</td>
                      <td className="px-3 py-2 text-center text-blue-600">{r.lastMonth}</td>
                      <td className="px-3 py-2 text-center text-red-600">{r.previous}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>
    </main>
  );
}
