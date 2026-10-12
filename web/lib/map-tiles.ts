/**
 * Peta dasar semua peta di aplikasi: peta standar OpenStreetMap, ditampilkan dengan warna aslinya supaya kota
 * terlihat hidup. Gratis dengan atribusi dan tanpa kunci API. Untuk berganti penyedia, cukup ubah di sini.
 * (Gaya "Voyager" dari CARTO sempat dicoba 12 Okt 2026; ubinnya kini bercap "API key required".)
 */
export const BASEMAP = {
  url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
};
