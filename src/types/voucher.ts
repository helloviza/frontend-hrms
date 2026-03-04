// apps/frontend/src/types/voucher.ts

export type VoucherType = "hotel" | "flight";
export type LayoutType = "SINGLE" | "DUAL" | "GROUP";

export type Passenger = {
  name: string | null;
  type: string | null; // Adult/Child/Infant etc
  seat: string | null;
  ticket_no: string | null;
  barcode_string: string | null;
};

export type FlightPlace = {
  code: string | null;
  city: string | null;
  time: string | null;
  date: string | null;
  terminal: string | null;
};

export type FlightAncillaries = {
  checkin_bag: string | null;
  cabin_bag: string | null;
  seat: string | null;
  barcode_string: string | null; // OCR BCBP string (critical for scanners)
};

export type FlightSegment = {
  airline: string | null;
  flight_no: string | null;
  class: string | null;
  duration: string | null;
  layover_duration: string | null;

  origin: FlightPlace;
  destination: FlightPlace;

  ancillaries: FlightAncillaries;
};

export type PlumtripsVoucher = {
  type: VoucherType;
  layout_type: LayoutType | null;

  booking_info: {
    pnr: string | null;
    booking_id: string | null;
    booking_date: string | null;
    voucher_no: string | null;
    supplier_conf_no: string | null;
    fare_type: string | null;
    custom_logo: string; // persistent branding
  };

  policies: {
    is_non_refundable: boolean | null;
    important_notes: string[];
  };

  // flight
  flight_details?: {
    segments: FlightSegment[];
  } | null;

  passengers?: Passenger[] | null;

  // hotel
  hotel_details?: {
    name: string | null;
    address: string | null;
    city: string | null;
    country: string | null;
  } | null;

  guest_details?: {
    primary_guest: string | null;
  } | null;

  room_details?: {
    room_type: string | null;
    inclusions: string[];
  } | null;

  stay_details?: {
    check_in_date: string | null;
    check_in_time: string | null;
    check_out_date: string | null;
    check_out_time: string | null;
    total_nights: string | null;
  } | null;
};
