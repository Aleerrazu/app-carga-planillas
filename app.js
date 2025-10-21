<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Control Horario – Panel</title>
  <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate"/>
  <meta http-equiv="Pragma" content="no-cache"/>
  <meta http-equiv="Expires" content="0"/>
  <style>
    :root{ --bg:#0f172a; --card:#111827; --muted:#1f2937; --accent:#6366f1;
           --good:#16a34a; --bad:#dc2626; --text:#e5e7eb; --textmuted:#94a3b8; --chip:#334155; --blue:#2563eb; }
    *{box-sizing:border-box} html,body{height:100%}
    body{margin:0;background:linear-gradient(180deg,#0b1223,#0f172a);color:var(--text);
         font-family:ui-sans-serif,system-ui,Segoe UI,Roboto,Ubuntu,Cantarell,"Noto Sans",sans-serif;}
    .wrap{max-width:1180px;margin:24px auto;padding:0 16px}
    .brand{display:flex;align-items:center;gap:10px;margin-bottom:16px}
    .brand .dot{width:12px;height:12px;border-radius:50%;background:var(--accent);box-shadow:0 0 18px rgba(99,102,241,.8)}
    .title{font-size:22px;font-weight:700;letter-spacing:.3px}
    .card{background:var(--card);border:1px solid #1f2937;border-radius:14px;box-shadow:0 10px 35px rgba(0,0,0,.25)}
    .grid{display:grid;gap:16px} .grid-3{grid-template-columns:1fr 1fr 1fr}
    .pad{padding:16px} .muted{color:var(--textmuted)}
    .row{display:flex;align-items:center;gap:10px;flex-wrap:wrap} .sp{justify-content:space-between}
    .btn{background:var(--accent);color:white;border:none;border-radius:10px;padding:10px 14px;font-weight:600;cursor:pointer}
    .btn.small{padding:6px 10px;border-radius:999px} .btn.ghost{background:transparent;border:1px solid #334155}
    .btn.danger{background:#ef4444}
    .chip{background:#334155;color:#e5e7eb;padding:4px 8px;border-radius:999px;font-size:12px}
    .hidden{display:none !important} .msg{margin:10px 0;font-size:14px}
    input,select,textarea{background:#0b1223;border:1px solid #1f2937;color:#e5e7eb;padding:10px 12px;border-radius:10px;width:100%}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{padding:12px 10px;border-bottom:1px solid #1f2937;vertical-align:middle}
    th{color:#93c5fd;text-align:left;background:#0b1223}
    .icon{width:36px;height:36px;border-radius:999px;border:2px solid #334155;background:transparent;color:#94a3b8;font-weight:900;cursor:pointer}
    .icon.active.good{background:#16a34a;border-color:#16a34a;color:white}
    .icon.active.bad{background:#dc2626;border-color:#dc2626;color:white}
    .icon.active.blue{background:#2563eb;border-color:#2563eb;color:white}
    .icon-row{display:flex;gap:8px;align-items:center;justify-content:center}
    .subrow{background:#0b1223}
    .trash{width:36px;height:36px;border-radius:999px;border:2px solid #334155;background:transparent;color:#94a3b8;cursor:pointer}
    .stack{display:flex;flex-direction:column;gap:4px} .tag{display:inline-block;background:#0b1223;border:1px solid #334155;border-radius:999px;padding:2px 8px;font-size:12px}
  </style>
  <script>window.__APP_VERSION="v2025.10.21-2044-00 UTC";</script>
</head>
<body>
  <div class="wrap">
    <div class="brand">
      <div class="dot"></div>
      <div class="title">Control Horario · Panel</div>
      <div class="chip" id="version-chip">v2025.10.21