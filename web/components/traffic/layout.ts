/**
 * Tempat tiga panel yang mengambang di atas peta pada layar lebar. Di layar sempit urutannya: ringkasan (kiri),
 * peta, keterangan warna, lalu daftar (kanan), supaya kesimpulan terbaca sebelum petanya.
 */
export const PANEL_BOTTOM =
  "px-3 pt-3 lg:absolute lg:bottom-3 lg:left-1/2 lg:z-[1001] lg:w-max lg:max-w-[calc(100%-48rem)] lg:-translate-x-1/2 lg:p-0";
export const PANEL_LEFT =
  "order-first p-3 lg:order-none lg:pointer-events-none lg:absolute lg:top-3 lg:bottom-3 lg:left-3 lg:w-[22rem] lg:overflow-y-auto lg:p-0 lg:[&>*]:pointer-events-auto";
export const PANEL_RIGHT = "p-3 lg:absolute lg:top-3 lg:right-3 lg:bottom-3 lg:w-[23rem] lg:p-0";
