
import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import imageCompression from "browser-image-compression";


type ComplaintStatus = "Submitted" | "Under Review" | "Resolved";

type Complaint = {
  id: string;
  referenceId: string;
  title: string;
  category: string;
  location: string;
  description: string;
  status: ComplaintStatus;
  createdAt: string;
  photos: string[];
  establishmentName: string;
  incidentDate: string;
};

type Profile = {
  name: string;
  email: string;
  phone: string;
};

type BackendPhoto =
  | string
  | {
      url?: string | null;
      imageUrl?: string | null;
      image_url?: string | null;
      path?: string | null;
      filePath?: string | null;
      fileUrl?: string | null;
      filename?: string | null;
      secure_url?: string | null;
      storageKey?: string | null;
      originalFilename?: string | null;
    };

type BackendComplaint = {
  id?: string | number;
  referenceId?: string;
  _id?: string | number;
  complaintId?: string | number;
  complaint_id?: string | number;
  title?: string;
  description?: string;
  foodType?: string;
  category?: string;
  establishmentName?: string;
  location?: string;
  incidentDate?: string;
  status?: string;
  createdAt?: string;
  attachments?: BackendPhoto[] | BackendPhoto | null;
  photos?: BackendPhoto[] | BackendPhoto | null;
  imageUrls?: BackendPhoto[] | BackendPhoto | null;
  photoUrls?: BackendPhoto[] | BackendPhoto | null;
  images?: BackendPhoto[] | BackendPhoto | null;
  [key: string]: unknown;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/+$/, "");

const categories = [
  "Food Contamination",
  "Expired Food",
  "Poor Hygiene",
  "Food Adulteration",
  "Unsafe Storage",
  "Other",
];

const statusOptions = ["All", "Submitted", "Under Review", "Resolved"];

const css = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap');
:root{--navy:#102b46;--teal:#20a67a;--bg:#f5f7fb;--text:#1d2939;--muted:#748094;--border:#e5eaf1}
*{box-sizing:border-box}
.cd-root{min-height:100vh;background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif}
.cd-root button,.cd-root input,.cd-root select,.cd-root textarea{font:inherit}
.cd-root button{cursor:pointer}
.cd-layout{display:flex;min-height:100vh}
.cd-sidebar{width:248px;flex-shrink:0;background:var(--navy);color:white;padding:26px 17px;display:flex;flex-direction:column}
.cd-brand{display:flex;align-items:center;gap:11px;padding:0 10px 32px}
.cd-brand-mark{width:39px;height:39px;border-radius:12px;background:var(--teal);display:grid;place-items:center;font-weight:800;font-size:18px}
.cd-brand-name{font-family:Manrope,sans-serif;font-size:19px;font-weight:800}
.cd-brand-sub{color:#b8c8d8;font-size:11px;margin-top:3px}
.cd-nav-label{color:#9db0c3;font-size:10px;font-weight:700;letter-spacing:1.4px;padding:8px 12px 12px}
.cd-nav{display:grid;gap:6px}
.cd-nav button{display:flex;align-items:center;gap:12px;width:100%;border:0;border-radius:10px;color:#d7e0e9;background:transparent;text-align:left;padding:12px;font-size:13px}
.cd-nav button:hover,.cd-nav button.active{background:#ffffff1f;color:white}
.cd-nav-icon{width:21px;text-align:center;font-size:17px}
.cd-sidebar-bottom{margin-top:auto;padding:17px 10px 0;border-top:1px solid #ffffff21}
.cd-sidebar-bottom p{color:#b8c8d8;font-size:12px;line-height:1.6}
.cd-sidebar-bottom button{border:0;background:none;color:#dce6ef;padding:7px 0;font-size:12px}
.cd-main{flex:1;min-width:0}
.cd-topbar{min-height:76px;background:white;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:14px 34px;gap:15px}
.cd-topbar-title{font-family:Manrope,sans-serif;font-weight:700;font-size:14px;color:var(--navy)}
.cd-topbar-right{display:flex;align-items:center;gap:16px}
.cd-topbar-caption{font-size:12px;color:var(--muted)}
.cd-profile-wrap{position:relative}
.cd-profile-trigger{display:flex;align-items:center;gap:10px;border:1px solid var(--border);background:white;border-radius:12px;padding:7px 11px}
.cd-avatar{width:35px;height:35px;border-radius:50%;display:grid;place-items:center;background:#e3f6ee;color:#16845f;font-weight:800;font-size:13px}
.cd-profile-name,.cd-profile-role{display:block;text-align:left}
.cd-profile-name{font-size:12px;font-weight:700;color:var(--navy)}
.cd-profile-role{font-size:11px;color:var(--muted);margin-top:3px}
.cd-chevron{color:var(--muted)}
.cd-dropdown{position:absolute;right:0;top:51px;width:225px;background:white;border:1px solid var(--border);box-shadow:0 12px 36px #102b461a;border-radius:13px;padding:9px;z-index:20}
.cd-dropdown-head{padding:10px 11px;border-bottom:1px solid var(--border);margin-bottom:6px}
.cd-dropdown-head strong,.cd-dropdown-head span{display:block;overflow-wrap:anywhere}
.cd-dropdown-head strong{font-size:13px;color:var(--navy)}
.cd-dropdown-head span{font-size:11px;color:var(--muted);margin-top:5px}
.cd-dropdown button{display:block;width:100%;text-align:left;padding:10px 11px;border:0;background:white;border-radius:8px;font-size:12px;color:var(--text)}
.cd-dropdown button:hover{background:var(--bg)}
.cd-dropdown button.danger{color:#c24141}
.cd-content{max-width:1240px;margin:0 auto;padding:30px 34px 45px}
.cd-welcome{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;margin-bottom:25px}
.cd-eyebrow{font-size:11px;letter-spacing:1.3px;font-weight:700;color:var(--teal)}
.cd-welcome h1{font-family:Manrope,sans-serif;font-size:27px;color:var(--navy);margin:8px 0}
.cd-welcome p{color:var(--muted);font-size:13px;line-height:1.65;margin:0;max-width:650px}
.cd-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:9px;padding:12px 16px;font-size:12px;font-weight:700}
.cd-button:disabled{opacity:.6;cursor:not-allowed}
.cd-button-primary{color:white;background:var(--teal)}
.cd-button-primary:hover{background:#168b66}
.cd-button-secondary{color:var(--navy);background:white;border:1px solid var(--border)}
.cd-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-bottom:25px}
.cd-stat,.cd-panel{background:white;border:1px solid var(--border);border-radius:14px}
.cd-stat{padding:20px}
.cd-stat-top{display:flex;justify-content:space-between;align-items:center;gap:10px}
.cd-stat-label{color:var(--muted);font-size:12px}
.cd-stat-icon{width:35px;height:35px;border-radius:10px;display:grid;place-items:center;background:#eaf8f2;color:var(--teal)}
.cd-stat-value{font-family:Manrope,sans-serif;color:var(--navy);font-size:28px;font-weight:800;margin-top:14px}
.cd-stat-foot{color:var(--muted);font-size:11px;margin-top:4px}
.cd-panel{padding:23px;margin-bottom:22px}
.cd-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:15px;margin-bottom:21px}
.cd-panel-head h2{font-family:Manrope,sans-serif;color:var(--navy);font-size:17px;margin:0}
.cd-panel-head p{color:var(--muted);font-size:12px;line-height:1.6;margin:7px 0 0}
.cd-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:17px}
.cd-field{display:flex;flex-direction:column;gap:8px;min-width:0}
.cd-field.full{grid-column:1/-1}
.cd-field label{font-size:12px;font-weight:700;color:#344054}
.cd-field label span{color:#d14b4b}
.cd-input,.cd-select,.cd-textarea{width:100%;border:1px solid #dce3ec;border-radius:9px;background:white;color:var(--text);padding:12px 13px;font-size:12px;outline:none}
.cd-input:focus,.cd-select:focus,.cd-textarea:focus{border-color:var(--teal);box-shadow:0 0 0 3px #20a67a18}
.cd-textarea{resize:vertical;min-height:115px;line-height:1.6}
.cd-help,.cd-footnote{color:var(--muted);font-size:11px;line-height:1.7}
.cd-upload{border:1px dashed #cbd5e1;border-radius:10px;padding:20px;text-align:center;background:#fbfcfe}
.cd-upload input{max-width:100%;font-size:11px;color:var(--muted)}
.cd-upload-title{font-size:12px;font-weight:700;color:var(--navy);margin:0 0 7px}
.cd-photo-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:10px;margin-top:12px}
.cd-photo{position:relative;height:90px;border-radius:9px;overflow:hidden;background:#f1f5f9;border:1px solid var(--border)}
.cd-photo img{width:100%;height:100%;object-fit:cover}
.cd-photo button{position:absolute;right:5px;top:5px;border:0;border-radius:50%;width:23px;height:23px;background:#102b46d9;color:white}
.cd-form-actions,.cd-profile-actions{display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:20px}
.cd-notice{padding:12px 14px;border-radius:9px;font-size:12px;line-height:1.6;margin-bottom:18px;overflow-wrap:anywhere}
.cd-notice.success{background:#eaf8f2;color:#176d50;border:1px solid #c9ecdd}
.cd-notice.error{background:#fff1f1;color:#ad3030;border:1px solid #f1d1d1}
.cd-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:17px}
.cd-search{flex:1;min-width:180px;position:relative}
.cd-search .cd-input{padding-left:36px}
.cd-search-icon{position:absolute;left:13px;top:12px;color:#8b98aa}
.cd-toolbar .cd-select{width:auto;min-width:155px}
.cd-table-wrap{width:100%;overflow-x:auto}
.cd-table{border-collapse:collapse;width:100%;min-width:620px}
.cd-table th{background:#f8fafc;color:#7b8798;font-size:10px;text-transform:uppercase;letter-spacing:.7px;text-align:left;padding:13px 12px}
.cd-table td{padding:15px 12px;border-bottom:1px solid #edf0f5;font-size:12px;vertical-align:middle}
.cd-table tbody tr:last-child td{border-bottom:0}
.cd-table tbody tr:hover{background:#fbfcfe}
.cd-complaint-title{color:var(--navy);font-weight:700;max-width:220px;overflow-wrap:anywhere}
.cd-complaint-id{font-size:10px;color:var(--muted);margin-top:5px;overflow-wrap:anywhere}
.cd-status{display:inline-block;padding:6px 9px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap}
.cd-status.submitted{background:#eaf2ff;color:#285eb7}
.cd-status.review{background:#fff4df;color:#a5670b}
.cd-status.resolved{background:#e6f7ef;color:#168357}
.cd-view-button{border:1px solid var(--border);background:white;border-radius:7px;padding:7px 10px;color:var(--navy);font-size:11px;font-weight:700}
.cd-view-button:hover{border-color:var(--teal);color:var(--teal)}
.cd-empty{text-align:center;padding:42px 15px}
.cd-empty-icon{margin:0 auto 13px;width:48px;height:48px;border-radius:14px;background:#eaf8f2;color:var(--teal);display:grid;place-items:center;font-size:21px}
.cd-empty h3{margin:0;color:var(--navy);font-size:14px}
.cd-empty p{color:var(--muted);font-size:12px;line-height:1.6;margin:8px auto 17px;max-width:360px}
.cd-modal-backdrop{position:fixed;inset:0;background:#10203385;display:grid;place-items:center;padding:20px;z-index:100;overflow-y:auto}
.cd-modal{background:white;border-radius:16px;width:min(100%,620px);max-height:90vh;overflow-y:auto;box-shadow:0 25px 80px #06172b3b}
.cd-modal-head{display:flex;justify-content:space-between;align-items:flex-start;gap:15px;padding:22px 24px;border-bottom:1px solid var(--border)}
.cd-modal-head h2{color:var(--navy);font-family:Manrope,sans-serif;font-size:19px;margin:0;overflow-wrap:anywhere}
.cd-modal-head p{color:var(--muted);font-size:11px;margin:7px 0 0;overflow-wrap:anywhere}
.cd-modal-close{border:0;background:#f2f5f9;color:var(--navy);border-radius:8px;width:32px;height:32px;font-size:20px;flex-shrink:0}
.cd-modal-body{padding:22px 24px}
.cd-detail-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px}
.cd-detail-label{font-size:10px;text-transform:uppercase;letter-spacing:.7px;color:var(--muted);font-weight:700;margin-bottom:7px}
.cd-detail-value{font-size:13px;color:var(--navy);overflow-wrap:anywhere}
.cd-detail-description{margin-top:22px}
.cd-detail-description h3{font-size:12px;color:var(--navy);margin:0 0 9px}
.cd-detail-description p{font-size:12px;line-height:1.7;color:#475467;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}
.cd-modal-photos{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px}
.cd-modal-photos img{width:100%;height:140px;object-fit:cover;border-radius:9px;border:1px solid var(--border);background:#f1f5f9}
.cd-profile-form{display:grid;gap:16px}
.cd-profile-summary{display:grid;gap:0}
.cd-profile-row{display:flex;justify-content:space-between;gap:20px;padding:13px 0;border-bottom:1px solid var(--border);font-size:12px}
.cd-profile-row:last-child{border-bottom:0}
.cd-profile-row span{color:var(--muted)}
.cd-profile-row strong{color:var(--navy);text-align:right;overflow-wrap:anywhere}
@media(max-width:900px){.cd-sidebar{width:205px}.cd-topbar{padding:14px 22px}.cd-content{padding:25px 22px}.cd-stats{gap:10px}.cd-stat{padding:15px}}
@media(max-width:680px){.cd-layout{display:block}.cd-sidebar{width:100%;padding:15px}.cd-brand{padding:0 7px 14px}.cd-nav-label{display:none}.cd-nav{grid-template-columns:repeat(3,minmax(0,1fr))}.cd-nav button{justify-content:center;padding:10px 5px;font-size:11px;gap:5px}.cd-nav-icon{width:auto}.cd-sidebar-bottom{display:none}.cd-topbar{padding:12px 16px;min-height:65px}.cd-topbar-caption{display:none}.cd-content{padding:20px 14px 32px}.cd-welcome{display:block}.cd-welcome h1{font-size:23px}.cd-welcome>.cd-button{margin-top:15px}.cd-stats{grid-template-columns:1fr;gap:10px}.cd-stat{padding:15px}.cd-stat-value{font-size:24px}.cd-panel{padding:16px}.cd-field-grid{grid-template-columns:1fr}.cd-field.full{grid-column:auto}.cd-panel-head{align-items:flex-start}.cd-panel-head>.cd-button{padding:10px;font-size:11px}.cd-detail-grid{grid-template-columns:1fr}.cd-modal-head,.cd-modal-body{padding:17px}.cd-profile-row{gap:10px}.cd-profile-row strong{max-width:60%}}
@media(max-width:380px){.cd-nav button{font-size:10px}.cd-topbar-title{font-size:11px}.cd-profile-trigger{padding:6px;gap:6px}.cd-profile-name{max-width:95px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.cd-content{padding-left:10px;padding-right:10px}.cd-panel{padding:12px}.cd-modal-backdrop{padding:8px}}
`;

function statusClass(status: ComplaintStatus) {
  if (status === "Resolved") return "resolved";
  if (status === "Under Review") return "review";
  return "submitted";
}

function mapStatus(status?: string): ComplaintStatus {
  const normalized = (status || "").toUpperCase().replace(/[\s-]+/g, "_");

  if (["RESOLVED", "CLOSED", "COMPLETED"].includes(normalized)) {
    return "Resolved";
  }

  if (
    [
      "UNDER_REVIEW",
      "IN_REVIEW",
      "IN_PROGRESS",
      "ASSIGNED",
      "INVESTIGATING",
    ].includes(normalized)
  ) {
    return "Under Review";
  }

  return "Submitted";
}

function formatDate(value?: string) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
}

function dateInputValue(value?: string) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length || name === "Citizen") return "C";

  return words
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Unable to read image."));
    };
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });
}

function getComplaintId(item: BackendComplaint): string {
  const candidate =
    item.complaintId ??
    item.complaint_id ??
    item.id ??
    item._id ??
    item["referenceNumber"] ??
    item["reference_number"];

  return candidate == null ? "" : String(candidate);
}

function normalizePhoto(photo: BackendPhoto): string {
  let value = "";

  if (typeof photo === "string") {
    value = photo.trim();
  } else if (photo && typeof photo === "object") {
    value =
      photo.url ||
photo.imageUrl ||
photo.image_url ||
photo.fileUrl ||
photo.filePath ||
photo.path ||
photo.secure_url ||
photo.filename ||
(photo.storageKey
  ? `/uploads/complaints/${encodeURIComponent(photo.storageKey)}`
  : "") ||
"";
    value = value.trim();
  }

  if (!value) return "";

  if (/^(data:image\/|blob:|https?:\/\/)/i.test(value)) {
    return value;
  }

  // Convert a backend path into a usable URL.
  const cleanPath = value.replace(/\\/g, "/").replace(/^\.?\//, "");

  const apiOrigin = API_BASE_URL || "http://localhost:5000";

return `${apiOrigin}/${cleanPath.replace(/^\/+/, "")}`;



  return `${API_BASE_URL}/${cleanPath}`;
}

function extractPhotos(item: BackendComplaint): string[] {
  const result: string[] = [];
  const sources = [
    item.photos,
    item.imageUrls,
    item.photoUrls,
    item.attachments,
    item.images,
  ];

  for (const source of sources) {
    if (!source) continue;

    const list = Array.isArray(source) ? source : [source];

    for (const photo of list) {
      if (typeof photo === "string") {
        const normalized = normalizePhoto(photo);
        if (normalized) result.push(normalized);
      } else if (photo && typeof photo === "object") {
        const normalized = normalizePhoto(photo);
        if (normalized) result.push(normalized);
      }
    }
  }

  return [...new Set(result)];
}

function mapComplaint(item: BackendComplaint, index = 0): Complaint {
  const id =
    getComplaintId(item) ||
    `missing-id-${String(item.createdAt || "record")}-${index}`;
  const rawCreatedAt = item.createdAt;
const createdAtDate = rawCreatedAt
  ? new Date(rawCreatedAt)
  : new Date();

const referenceYear = Number.isNaN(createdAtDate.getTime())
  ? new Date().getFullYear()
  : createdAtDate.getFullYear();

const numericId = Number(id);

const referenceId =
  item.referenceId ||
  (Number.isSafeInteger(numericId) && numericId > 0
    ? `FSI-${referenceYear}-${String(numericId).padStart(5, "0")}`
    : id);
 return {
  id,
  referenceId,
  title: item.title || "Untitled complaint",
  category: item.foodType || item.category || "Other",
  location: item.location || "",
  description: item.description || "",
  status: mapStatus(item.status),
  createdAt: formatDate(item.createdAt),
  photos: extractPhotos(item),
  establishmentName: item.establishmentName || "",
  incidentDate: dateInputValue(item.incidentDate),
};
}

function readStoredUser(): Partial<Profile> {
  try {
    const user = JSON.parse(sessionStorage.getItem("foster_user") || "{}");

    return {
      name: typeof user.name === "string" ? user.name : "Citizen",
      email: typeof user.email === "string" ? user.email : "",
      phone: typeof user.phone === "string" ? user.phone : "",
    };
  } catch {
    return { name: "Citizen", email: "", phone: "" };
  }
}

export default function CitizenDashboard() {
  const navigate = useNavigate();
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile>(() => {
    const user = readStoredUser();
    return {
      name: user.name || "Citizen",
      email: user.email || "",
      phone: user.phone || "",
    };
  });

  const [profileDraft, setProfileDraft] = useState<Profile>(() => {
    const user = readStoredUser();
    return {
      name: user.name || "Citizen",
      email: user.email || "",
      phone: user.phone || "",
    };
  });

  const [editingProfile, setEditingProfile] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loadingComplaints, setLoadingComplaints] = useState(true);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);

  const [activeSection, setActiveSection] = useState<
    "dashboard" | "report" | "complaints"
  >("dashboard");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedComplaint, setSelectedComplaint] =
    useState<Complaint | null>(null);

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(categories[0]);
  const [location, setLocation] = useState("");
  const [establishmentName, setEstablishmentName] = useState("");
  const [incidentDate, setIncidentDate] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState("");

  const showNotice = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setNotice(message);
    setNoticeType(type);
  };

  const apiRequest = async (path: string, options: RequestInit = {}) => {
    const token = sessionStorage.getItem("foster_token");
    if (!token) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    const url = /^https?:\/\//i.test(path)
      ? path
      : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      sessionStorage.removeItem("foster_token");
      sessionStorage.removeItem("foster_user");
      navigate("/login/citizen");
      throw new Error("Your session has expired. Please sign in again.");
    }

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          `Request failed with status ${response.status}.`,
      );
    }

    return data;
  };

  const loadComplaints = async () => {
    setLoadingComplaints(true);

    try {
      const data = await apiRequest("/api/complaints/my");
      const records: BackendComplaint[] = Array.isArray(data.complaints)
        ? data.complaints
        : Array.isArray(data.data?.complaints)
          ? data.data.complaints
          : Array.isArray(data.data)
            ? data.data
            : [];

      setComplaints(records.map((item, index) => mapComplaint(item, index)));
    } catch (error) {
      showNotice(
        error instanceof Error ? error.message : "Unable to load complaints.",
        "error",
      );
    } finally {
      setLoadingComplaints(false);
    }
  };

  useEffect(() => {
    void loadComplaints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setProfileMenuOpen(false);
      }
    };

    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
        setProfileModalOpen(false);
        setSelectedComplaint(null);
      }
    };

    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);

    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();

    return complaints.filter(
      (complaint) =>
        (statusFilter === "All" || complaint.status === statusFilter) &&
        (!query ||
          complaint.title.toLowerCase().includes(query) ||
          complaint.id.toLowerCase().includes(query) ||
          complaint.referenceId.toLowerCase().includes(query) ||
          complaint.category.toLowerCase().includes(query) ||
          complaint.location.toLowerCase().includes(query) ||
          complaint.establishmentName.toLowerCase().includes(query)),
    );
  }, [complaints, search, statusFilter]);

  const reviewCount = complaints.filter(
    (complaint) => complaint.status === "Under Review",
  ).length;

  const resolvedCount = complaints.filter(
    (complaint) => complaint.status === "Resolved",
  ).length;

  const openProfile = (edit = false) => {
    setProfileDraft({ ...profile });
    setEditingProfile(edit);
    setProfileModalOpen(true);
    setProfileMenuOpen(false);
  };

  const saveProfile = () => {
    if (!profileDraft.name.trim()) {
      showNotice("Please enter your full name.", "error");
      return;
    }

    if (
      profileDraft.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileDraft.email.trim())
    ) {
      showNotice("Please enter a valid email address.", "error");
      return;
    }

    const next = {
      name: profileDraft.name.trim(),
      email: profileDraft.email.trim(),
      phone: profileDraft.phone.trim(),
    };

    setProfile(next);
    setProfileDraft(next);

    try {
      const currentUser = JSON.parse(
        sessionStorage.getItem("foster_user") || "{}",
      );

      sessionStorage.setItem(
        "foster_user",
        JSON.stringify({ ...currentUser, ...next }),
      );
    } catch {
      // Keep updated profile in React state for this session.
    }

    setEditingProfile(false);
    setNotice("");
  };


  const handlePhotoChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const input = event.currentTarget;
    const files = Array.from(input.files ?? []);
    input.value = "";
    setPhotoError("");

    if (files.length === 0) return;

    if (photos.length + files.length > 5) {
      setPhotoError("You can attach up to 5 photos in total.");
      return;
    }

    const accepted = ["image/jpeg", "image/png", "image/webp"];
    const valid: File[] = [];

    for (const file of files) {
      if (!accepted.includes(file.type)) {
        setPhotoError("Only JPG, PNG and WebP images are allowed.");
        continue;
      }

      if (file.size > 10 * 1024 * 1024) {
        setPhotoError("Each original photo must be 10 MB or smaller.");
        continue;
      }

      valid.push(file);
    }

    try {
      const dataUrls = await Promise.all(
        valid.map(async (file) => {
          const compressedFile = await imageCompression(file, {
            maxSizeMB: 0.35,
            maxWidthOrHeight: 1280,
            useWebWorker: false,
            fileType: "image/jpeg",
          });

          return readFileAsDataUrl(compressedFile);
        }),
      );

      setPhotos((current) => [...current, ...dataUrls].slice(0, 5));
    } catch (error) {
      console.error("Photo compression failed:", error);
      setPhotoError(
        "Unable to compress or load photos. Please try smaller JPG, PNG or WebP images.",
      );
    }
  };


  const removePhoto = (index: number) => {
    setPhotos((current) => current.filter((_, i) => i !== index));
  };

  const resetComplaintForm = () => {
    setTitle("");
    setCategory(categories[0]);
    setLocation("");
    setEstablishmentName("");
    setIncidentDate("");
    setDescription("");
    setPhotos([]);
    setPhotoError("");

    if (photoInputRef.current) photoInputRef.current.value = "";
  };

  const submitComplaint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotice("");

    if (
      !title.trim() ||
      !category.trim() ||
      !location.trim() ||
      !establishmentName.trim() ||
      !incidentDate ||
      !description.trim()
    ) {
      showNotice("Please complete all required fields.", "error");
      return;
    }

    const parsedIncidentDate = new Date(`${incidentDate}T12:00:00`);

    if (Number.isNaN(parsedIncidentDate.getTime())) {
      showNotice("Please enter a valid incident date.", "error");
      return;
    }

    if (parsedIncidentDate.getTime() > Date.now()) {
      showNotice("Incident date cannot be in the future.", "error");
      return;
    }

    setSubmittingComplaint(true);

    try {
      const data = await apiRequest("/api/complaints", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          foodType: category,
          establishmentName: establishmentName.trim(),
          location: location.trim(),
          incidentDate,
          photos,
        }),
      });

      const savedData = (data.complaint ??
        data.data?.complaint ??
        data.data) as BackendComplaint | undefined;

      if (!savedData || !getComplaintId(savedData)) {
        throw new Error(
          "The server did not return a complaint ID. The backend must save the complaint and return its database ID.",
        );
      }

      const savedComplaint = mapComplaint(savedData);

      setComplaints((current) => [
        savedComplaint,
        ...current.filter((item) => item.id !== savedComplaint.id),
      ]);

      setActiveSection("complaints");
      setSearch("");
      setStatusFilter("All");
      resetComplaintForm();

      showNotice(
        `Complaint ${savedComplaint.id} submitted successfully.`,
        "success",
      );
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Unable to submit complaint. Please try again.",
        "error",
      );
    } finally {
      setSubmittingComplaint(false);
    }
  };

  const goToSection = (
    section: "dashboard" | "report" | "complaints",
  ) => {
    setActiveSection(section);
    setProfileMenuOpen(false);
    setNotice("");
  };

  const handleLogout = () => {
    sessionStorage.removeItem("foster_token");
    sessionStorage.removeItem("foster_user");
    navigate("/login/citizen");
  };

  return (
    <div className="cd-root">
      <style>{css}</style>

      <div className="cd-layout">
        <aside className="cd-sidebar">
          <div className="cd-brand">
            <div className="cd-brand-mark">F</div>
            <div>
              <div className="cd-brand-name">FOSTER AI</div>
              <div className="cd-brand-sub">Food Safety Intelligence</div>
            </div>
          </div>

          <div className="cd-nav-label">CITIZEN PORTAL</div>

          <nav className="cd-nav">
            <button
              className={activeSection === "dashboard" ? "active" : ""}
              onClick={() => goToSection("dashboard")}
            >
              <span className="cd-nav-icon">⌂</span> Dashboard
            </button>
            <button
              className={activeSection === "report" ? "active" : ""}
              onClick={() => goToSection("report")}
            >
              <span className="cd-nav-icon">＋</span> Report a concern
            </button>
            <button
              className={activeSection === "complaints" ? "active" : ""}
              onClick={() => goToSection("complaints")}
            >
              <span className="cd-nav-icon">▤</span> My complaints
            </button>
          </nav>

          <div className="cd-sidebar-bottom">
            <p>
              Help make food safer. Record a food-safety concern to support
              quicker action.
            </p>
            <button onClick={handleLogout}>↪ Sign out</button>
          </div>
        </aside>

        <main className="cd-main">
          <header className="cd-topbar">
            <div className="cd-topbar-title">Citizen Portal / FOSTER AI</div>
            <div className="cd-topbar-right">
              <span className="cd-topbar-caption">
                Food Safety Intelligence
              </span>

              <div className="cd-profile-wrap" ref={profileMenuRef}>
                <button
                  className="cd-profile-trigger"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  aria-expanded={profileMenuOpen}
                >
                  <span className="cd-avatar">{getInitials(profile.name)}</span>
                  <span>
                    <span className="cd-profile-name">{profile.name}</span>
                    <span className="cd-profile-role">Citizen</span>
                  </span>
                  <span className="cd-chevron">⌄</span>
                </button>

                {profileMenuOpen && (
                  <div className="cd-dropdown">
                    <div className="cd-dropdown-head">
                      <strong>{profile.name}</strong>
                      <span>{profile.email || "Citizen account"}</span>
                    </div>
                    <button onClick={() => openProfile(false)}>
                      View profile
                    </button>
                    <button onClick={() => openProfile(true)}>
                      Edit profile
                    </button>
                    <button className="danger" onClick={handleLogout}>
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          </header>

          <div className="cd-content">
            <section className="cd-welcome">
              <div>
                <div className="cd-eyebrow">CITIZEN DASHBOARD</div>
                <h1>Welcome, {profile.name || "Citizen"}</h1>
                <p>
                  Report food-safety concerns, keep track of your reports, and
                  help make food safer for everyone.
                </p>
              </div>
              <button
                className="cd-button cd-button-primary"
                onClick={() => goToSection("report")}
              >
                ＋ Report a concern
              </button>
            </section>

            {notice && (
              <div className={`cd-notice ${noticeType}`} role="status">
                {notice}
              </div>
            )}

            {activeSection === "dashboard" && (
              <>
                <section className="cd-stats">
                  <Stat
                    label="Total reports recorded"
                    value={complaints.length}
                    foot={loadingComplaints ? "Loading records..." : "Saved reports"}
                    icon="▤"
                  />
                  <Stat
                    label="Under review"
                    value={reviewCount}
                    foot="Awaiting review"
                    icon="◷"
                  />
                  <Stat
                    label="Resolved reports"
                    value={resolvedCount}
                    foot="Marked as resolved"
                    icon="✓"
                  />
                </section>

                <section className="cd-panel">
                  <div className="cd-panel-head">
                    <div>
                      <h2>Recent complaints</h2>
                      <p>Your latest recorded food-safety concerns.</p>
                    </div>
                    <button
                      className="cd-button cd-button-secondary"
                      onClick={() => goToSection("complaints")}
                    >
                      View all
                    </button>
                  </div>

                  {loadingComplaints ? (
                    <div className="cd-empty">
                      <p>Loading your complaints...</p>
                    </div>
                  ) : (
                    <ComplaintTable
                      complaints={complaints.slice(0, 5)}
                      onView={setSelectedComplaint}
                      emptyTitle="No complaints recorded yet"
                      emptyDescription="Create a complaint to see its record here."
                      onCreate={() => goToSection("report")}
                      showCreateButton
                    />
                  )}
                </section>
              </>
            )}

            {activeSection === "report" && (
              <section className="cd-panel">
                <div className="cd-panel-head">
                  <div>
                    <h2>Report a food-safety concern</h2>
                    <p>
                      Provide the details below. You can optionally attach
                      photos as supporting evidence.
                    </p>
                  </div>
                </div>

                <form onSubmit={submitComplaint}>
                  <div className="cd-field-grid">
                    <div className="cd-field full">
                      <label htmlFor="cd-title">
                        Complaint title <span>*</span>
                      </label>
                      <input
                        id="cd-title"
                        className="cd-input"
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="Briefly describe the issue"
                        maxLength={120}
                        required
                      />
                    </div>

                    <div className="cd-field">
                      <label htmlFor="cd-category">
                        Concern category <span>*</span>
                      </label>
                      <select
                        id="cd-category"
                        className="cd-select"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
                        required
                      >
                        {categories.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="cd-field">
                      <label htmlFor="cd-location">
                        Location <span>*</span>
                      </label>
                      <input
                        id="cd-location"
                        className="cd-input"
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="Area, street or address"
                        maxLength={180}
                        required
                      />
                    </div>

                    <div className="cd-field">
                      <label htmlFor="cd-establishment">
                        Establishment name <span>*</span>
                      </label>
                      <input
                        id="cd-establishment"
                        className="cd-input"
                        value={establishmentName}
                        onChange={(event) =>
                          setEstablishmentName(event.target.value)
                        }
                        placeholder="Restaurant, shop or food vendor"
                        maxLength={180}
                        required
                      />
                    </div>

                    <div className="cd-field">
                      <label htmlFor="cd-incident-date">
                        Incident date <span>*</span>
                      </label>
                      <input
                        id="cd-incident-date"
                        className="cd-input"
                        type="date"
                        value={incidentDate}
                        max={dateInputValue(new Date().toISOString())}
                        onChange={(event) => setIncidentDate(event.target.value)}
                        required
                      />
                    </div>

                    <div className="cd-field full">
                      <label htmlFor="cd-description">
                        Describe the concern <span>*</span>
                      </label>
                      <textarea
                        id="cd-description"
                        className="cd-textarea"
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        placeholder="Explain what happened, when you noticed it, and any relevant details."
                        maxLength={3000}
                        required
                      />
                      <div className="cd-help">
                        {description.length}/3000 characters
                      </div>
                    </div>

                    <div className="cd-field full">
                      <label>Supporting photos (optional)</label>
                      <div className="cd-upload">
                        <p className="cd-upload-title">
                          Add photos of the concern
                        </p>
                        <p className="cd-help">
                          JPG, PNG or WebP · Maximum 5 photos · 10 MB per original photo
                        </p>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handlePhotoChange}
                          disabled={photos.length >= 5 || submittingComplaint}
                          aria-label="Upload supporting photos"
                        />

                        {photos.length > 0 && (
                          <div className="cd-photo-grid">
                            {photos.map((photo, index) => (
                              <div
                                className="cd-photo"
                                key={`${index}-${photo.slice(0, 30)}`}
                              >
                                <img
                                  src={photo}
                                  alt={`Attachment ${index + 1}`}
                                />
                                <button
                                  type="button"
                                  onClick={() => removePhoto(index)}
                                  aria-label={`Remove photo ${index + 1}`}
                                  disabled={submittingComplaint}
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {photoError && (
                        <div className="cd-notice error">{photoError}</div>
                      )}
                    </div>
                  </div>


                  <div className="cd-form-actions">
                    <button
                      type="button"
                      className="cd-button cd-button-secondary"
                      onClick={resetComplaintForm}
                      disabled={submittingComplaint}
                    >
                      Clear form
                    </button>
                    <button
                      type="submit"
                      className="cd-button cd-button-primary"
                      disabled={submittingComplaint}
                    >
                      {submittingComplaint ? "Submitting..." : "Submit Complaint →"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {activeSection === "complaints" && (
              <section className="cd-panel">
                <div className="cd-panel-head">
                  <div>
                    <h2>All complaints</h2>
                    <p>
                      {loadingComplaints
                        ? "Loading saved records..."
                        : `${complaints.length} ${
                            complaints.length === 1 ? "record" : "records"
                          } saved in your account`}
                    </p>
                  </div>
                  <button
                    className="cd-button cd-button-primary"
                    onClick={() => goToSection("report")}
                  >
                    ＋ New complaint
                  </button>
                </div>

                <div className="cd-toolbar">
                  <div className="cd-search">
                    <span className="cd-search-icon">⌕</span>
                    <input
                      className="cd-input"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search by title, ID, category or location"
                      aria-label="Search complaints"
                    />
                  </div>
                  <select
                    className="cd-select"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    aria-label="Filter by status"
                  >
                    {statusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status === "All" ? "All statuses" : status}
                      </option>
                    ))}
                  </select>
                </div>

                {loadingComplaints ? (
                  <div className="cd-empty">
                    <p>Loading your complaints...</p>
                  </div>
                ) : (
                  <ComplaintTable
                    complaints={filteredComplaints}
                    onView={setSelectedComplaint}
                    emptyTitle={
                      complaints.length === 0
                        ? "No complaints recorded yet"
                        : "No matching complaints"
                    }
                    emptyDescription={
                      complaints.length === 0
                        ? "Create a complaint to see its record here."
                        : "Try a different search term or status filter."
                    }
                    onCreate={() => goToSection("report")}
                    showCreateButton={complaints.length === 0}
                  />
                )}

                <p className="cd-footnote">
                  Complaint records are retrieved from the backend.
                </p>
              </section>
            )}
          </div>
        </main>
      </div>

      {profileModalOpen && (
        <div
          className="cd-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setProfileModalOpen(false);
              setEditingProfile(false);
            }
          }}
        >
          <div
            className="cd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cd-profile-title"
          >
            <div className="cd-modal-head">
              <div>
                <h2 id="cd-profile-title">
                  {editingProfile ? "Edit profile" : "Your profile"}
                </h2>
                <p>Citizen account information</p>
              </div>
              <button
                className="cd-modal-close"
                onClick={() => {
                  setProfileModalOpen(false);
                  setEditingProfile(false);
                }}
                aria-label="Close profile"
              >
                ×
              </button>
            </div>

            <div className="cd-modal-body">
              {editingProfile ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    saveProfile();
                  }}
                >
                  <div className="cd-profile-form">
                    <div className="cd-field">
                      <label htmlFor="cd-profile-name">
                        Full name <span>*</span>
                      </label>
                      <input
                        id="cd-profile-name"
                        className="cd-input"
                        value={profileDraft.name}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        maxLength={100}
                        required
                      />
                    </div>

                    <div className="cd-field">
                      <label htmlFor="cd-profile-email">Email address</label>
                      <input
                        id="cd-profile-email"
                        className="cd-input"
                        type="email"
                        value={profileDraft.email}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                        placeholder="Enter your email address"
                      />
                    </div>

                    <div className="cd-field">
                      <label htmlFor="cd-profile-phone">Phone number</label>
                      <input
                        id="cd-profile-phone"
                        className="cd-input"
                        type="tel"
                        value={profileDraft.phone}
                        onChange={(event) =>
                          setProfileDraft((current) => ({
                            ...current,
                            phone: event.target.value,
                          }))
                        }
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </div>

                  <div className="cd-profile-actions">
                    <button
                      type="button"
                      className="cd-button cd-button-secondary"
                      onClick={() => {
                        setProfileDraft({ ...profile });
                        setEditingProfile(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="cd-button cd-button-primary"
                    >
                      Save changes
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="cd-profile-summary">
                    <ProfileRow label="Full name" value={profile.name || "Not provided"} />
                    <ProfileRow label="Account type" value="Citizen" />
                    <ProfileRow label="Email address" value={profile.email || "Not provided"} />
                    <ProfileRow label="Phone number" value={profile.phone || "Not provided"} />
                  </div>
                  <div className="cd-profile-actions">
                    <button
                      className="cd-button cd-button-secondary"
                      onClick={() => setProfileModalOpen(false)}
                    >
                      Close
                    </button>
                    <button
                      className="cd-button cd-button-primary"
                      onClick={() => openProfile(true)}
                    >
                      Edit profile
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedComplaint && (
        <div
          className="cd-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedComplaint(null);
            }
          }}
        >
          <div
            className="cd-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cd-complaint-title"
          >
            <div className="cd-modal-head">
              <div>
                <h2 id="cd-complaint-title">{selectedComplaint.title}</h2>
                <p>Complaint Reference: {selectedComplaint.referenceId}</p>
              </div>
              <button
                className="cd-modal-close"
                onClick={() => setSelectedComplaint(null)}
                aria-label="Close complaint details"
              >
                ×
              </button>
            </div>

            <div className="cd-modal-body">
              <div className="cd-detail-grid">
                <Detail label="Category" value={selectedComplaint.category} />
                <div>
                  <div className="cd-detail-label">Status</div>
                  <span className={`cd-status ${statusClass(selectedComplaint.status)}`}>
                    {selectedComplaint.status}
                  </span>
                </div>
                <Detail
                  label="Establishment"
                  value={selectedComplaint.establishmentName || "Not provided"}
                />
                <Detail label="Location" value={selectedComplaint.location} />
                <Detail
                  label="Incident date"
                  value={
                    selectedComplaint.incidentDate
                      ? formatDate(selectedComplaint.incidentDate)
                      : "Not provided"
                  }
                />
                <Detail label="Date recorded" value={selectedComplaint.createdAt} />
              </div>

              <div className="cd-detail-description">
                <h3>Description</h3>
                <p>{selectedComplaint.description || "No description provided."}</p>
              </div>

              <div className="cd-detail-description">
                <h3>Supporting photos</h3>
                {selectedComplaint.photos.length > 0 ? (
                  <div className="cd-modal-photos">
                    {selectedComplaint.photos.map((photo, index) => (
                      <a
                        key={`${index}-${photo.slice(0, 30)}`}
                        href={photo}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <img
                          src={photo}
                          alt={`Complaint attachment ${index + 1}`}
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p>No supporting photos were returned by the server.</p>
                )}
              </div>

              <div className="cd-profile-actions">
                <button
                  className="cd-button cd-button-secondary"
                  onClick={() => setSelectedComplaint(null)}
                >
                  Close details
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  foot,
  icon,
}: {
  label: string;
  value: number;
  foot: string;
  icon: string;
}) {
  return (
    <div className="cd-stat">
      <div className="cd-stat-top">
        <span className="cd-stat-label">{label}</span>
        <span className="cd-stat-icon">{icon}</span>
      </div>
      <div className="cd-stat-value">{value}</div>
      <div className="cd-stat-foot">{foot}</div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="cd-detail-label">{label}</div>
      <div className="cd-detail-value">{value || "Not provided"}</div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="cd-profile-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

type ComplaintTableProps = {
  complaints: Complaint[];
  onView: (complaint: Complaint) => void;
  emptyTitle: string;
  emptyDescription: string;
  onCreate: () => void;
  showCreateButton?: boolean;
};

function ComplaintTable({
  complaints,
  onView,
  emptyTitle,
  emptyDescription,
  onCreate,
  showCreateButton = true,
}: ComplaintTableProps) {
  if (!complaints.length) {
    return (
      <div className="cd-empty">
        <div className="cd-empty-icon">▤</div>
        <h3>{emptyTitle}</h3>
        <p>{emptyDescription}</p>
        {showCreateButton && (
          <button
            className="cd-button cd-button-primary"
            onClick={onCreate}
          >
            ＋ Report a concern
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="cd-table-wrap">
      <table className="cd-table">
        <thead>
          <tr>
            <th>Complaint</th>
            <th>Category</th>
            <th>Date</th>
            <th>Status</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {complaints.map((complaint) => (
            <tr key={complaint.id}>
              <td>
                <div className="cd-complaint-title">{complaint.title}</div>
                <div className="cd-complaint-id">{complaint.referenceId}</div>
              </td>
              <td>{complaint.category}</td>
              <td>{complaint.createdAt}</td>
              <td>
                <span className={`cd-status ${statusClass(complaint.status)}`}>
                  {complaint.status}
                </span>
              </td>
              <td>
                <button
                  className="cd-view-button"
                  onClick={() => onView(complaint)}
                >
                  View details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
