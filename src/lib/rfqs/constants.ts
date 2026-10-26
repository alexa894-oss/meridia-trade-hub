import type { Database } from "@/lib/supabase/database.types";

export type RfqStatus = Database["public"]["Enums"]["rfq_status"];
export type Incoterm = Database["public"]["Enums"]["incoterm"];
export type ShippingMode = Database["public"]["Enums"]["shipping_mode"];

export const rfqStatuses: RfqStatus[] = [
  "submitted",
  "assigned",
  "quoted",
  "negotiating",
  "order_created",
  "info_requested",
  "no_response",
  "draft",
  "closed",
];
// Términos de cotización y modalidad de carga son campos distintos.
export const incoterms: Incoterm[] = ["FOB", "CIF", "EXW"];
export const shippingModes: ShippingMode[] = ["FCL", "LCL", "air", "samples", "undecided"];
export const editableRfqStatuses: RfqStatus[] = ["draft", "info_requested"];
