import io
from datetime import datetime
from typing import Dict, Any, List
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

def generate_pdf_report(
    investigation: Dict[str, Any],
    documents: List[Dict[str, Any]],
    findings: List[Dict[str, Any]],
    claims: List[Dict[str, Any]],
    gaps: List[Dict[str, Any]],
    dimensions: List[Dict[str, Any]]
) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=36,
        leftMargin=36,
        topMargin=36,
        bottomMargin=36
    )

    styles = getSampleStyleSheet()

    # Brand color definitions
    c_primary = colors.HexColor("#49372C")
    c_secondary = colors.HexColor("#725541")
    c_copper = colors.HexColor("#B8754D")
    c_bg_light = colors.HexColor("#F8F5EF")
    c_border = colors.HexColor("#E4D8C8")
    c_text = colors.HexColor("#302820")
    c_muted = colors.HexColor("#786C60")

    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=20,
        leading=24,
        textColor=c_primary
    )

    subtitle_style = ParagraphStyle(
        'DocSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=10,
        leading=14,
        textColor=c_copper
    )

    h2_style = ParagraphStyle(
        'H2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=13,
        leading=17,
        textColor=c_primary,
        spaceBefore=12,
        spaceAfter=4
    )

    body_style = ParagraphStyle(
        'Body',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=c_text
    )

    badge_style = ParagraphStyle(
        'Badge',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=10,
        textColor=colors.white
    )

    elements = []

    # Header / Title
    elements.append(Paragraph("TRUSTTRACE AI &mdash; DIGITAL EVIDENCE VERIFICATION REPORT", subtitle_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"Case Report: {investigation.get('name', 'Investigation')}", title_style))
    elements.append(Spacer(1, 4))
    elements.append(Paragraph(f"<b>Tagline:</b> Beyond Fake Detection. Understand the Entire Evidence Story. &bull; Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}", body_style))
    elements.append(Spacer(1, 8))
    elements.append(HRFlowable(width="100%", thickness=1.5, color=c_copper, spaceBefore=4, spaceAfter=10))

    # Investigation Metadata Summary Box
    meta_data = [
        [
            Paragraph("<b>Case Reference:</b>", body_style),
            Paragraph(str(investigation.get('case_reference') or "N/A"), body_style),
            Paragraph("<b>Category:</b>", body_style),
            Paragraph(str(investigation.get('category', 'General')), body_style),
        ],
        [
            Paragraph("<b>Current Status:</b>", body_style),
            Paragraph(f"<b>{investigation.get('status', 'Review Required')}</b>", body_style),
            Paragraph("<b>Analysis Version:</b>", body_style),
            Paragraph(f"Version {investigation.get('current_version', 1)}", body_style),
        ],
        [
            Paragraph("<b>Primary Claim:</b>", body_style),
            Paragraph(f"<i>{investigation.get('primary_claim', 'None')}</i>", body_style),
            Paragraph("<b>Documents:</b>", body_style),
            Paragraph(f"{len(documents)} Evidence Files", body_style),
        ]
    ]

    t_meta = Table(meta_data, colWidths=[95, 175, 80, 190])
    t_meta.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_bg_light),
        ('BOX', (0, 0), (-1, -1), 1, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(t_meta)
    elements.append(Spacer(1, 14))

    # Section 1: 4-Dimensional Reliability Assessment
    elements.append(Paragraph("1. Claim Reliability Assessment (Multi-Dimensional)", h2_style))
    elements.append(Paragraph("TrustTrace AI avoids simplistic binary 'real vs fake' labels. Findings are calibrated along four forensic axes:", body_style))
    elements.append(Spacer(1, 6))

    dim_rows = [
        [Paragraph("<b>Forensic Dimension</b>", body_style), Paragraph("<b>Evaluated Status</b>", body_style), Paragraph("<b>Forensic Observations & Action</b>", body_style)]
    ]
    for d in dimensions:
        dim_rows.append([
            Paragraph(f"<b>{d.get('dimension_name')}</b>", body_style),
            Paragraph(f"{d.get('status')}", body_style),
            Paragraph(f"{d.get('explanation')}<br/><font color='#725541'><b>Next Step:</b> {d.get('suggested_next_action')}</font>", body_style)
        ])

    t_dim = Table(dim_rows, colWidths=[120, 120, 300])
    t_dim.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EFE6D8")),
        ('BOX', (0, 0), (-1, -1), 1, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_dim)
    elements.append(Spacer(1, 14))

    # Section 2: Evidentiary Documents Reviewed
    elements.append(Paragraph("2. Evidence Inventory & Representation Classification", h2_style))
    doc_rows = [
        [
            Paragraph("<b>File Name</b>", body_style),
            Paragraph("<b>Classification</b>", body_style),
            Paragraph("<b>Hash (SHA-256)</b>", body_style),
            Paragraph("<b>Completeness</b>", body_style)
        ]
    ]
    for d in documents:
        doc_rows.append([
            Paragraph(f"<b>{d.get('file_name')}</b><br/><font color='#786C60'>{d.get('category')}</font>", body_style),
            Paragraph(f"{d.get('classification')}", body_style),
            Paragraph(f"<font size='7'>{d.get('file_hash', '')[:20]}...</font>", body_style),
            Paragraph(f"{int(d.get('metadata', {}).get('completeness_score', 0) * 100)}%", body_style)
        ])

    t_docs = Table(doc_rows, colWidths=[160, 140, 160, 80])
    t_docs.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EFE6D8")),
        ('BOX', (0, 0), (-1, -1), 1, c_border),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    elements.append(t_docs)
    elements.append(Spacer(1, 14))

    # Section 3: Traceable Forensic Findings
    elements.append(Paragraph("3. Traceable Findings & Observations", h2_style))
    if findings:
        f_rows = [
            [
                Paragraph("<b>ID / Severity</b>", body_style),
                Paragraph("<b>Category</b>", body_style),
                Paragraph("<b>Forensic Explanation & Observations</b>", body_style),
                Paragraph("<b>Review Status</b>", body_style)
            ]
        ]
        for f in findings:
            f_rows.append([
                Paragraph(f"<b>{f.get('finding_id')}</b><br/><font color='{'#991B1B' if f.get('severity') == 'High' else '#B45309'}'><b>{f.get('severity')}</b></font>", body_style),
                Paragraph(f"{f.get('category')}", body_style),
                Paragraph(f"{f.get('explanation')}<br/><font color='#786C60'><b>Observed:</b> {', '.join(f.get('supporting_observations', []))}</font><br/><font color='#B8754D'><b>Recommendation:</b> {f.get('suggested_verification_step')}</font>", body_style),
                Paragraph(f"{f.get('reviewer_status', 'Open')}", body_style)
            ])
        t_find = Table(f_rows, colWidths=[75, 105, 280, 80])
        t_find.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#EFE6D8")),
            ('BOX', (0, 0), (-1, -1), 1, c_border),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, c_border),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ]))
        elements.append(t_find)
    else:
        elements.append(Paragraph("<i>No inconsistencies or suspicious dependencies detected across evaluated files.</i>", body_style))
    elements.append(Spacer(1, 14))

    # Section 4: Evidence Gaps & Missing Information
    elements.append(Paragraph("4. Evidence Gaps & Actionable Recommendations", h2_style))
    if gaps:
        for g in gaps:
            elements.append(Paragraph(f"&bull; <b>Identified Gap:</b> {g.get('missing_information')}", body_style))
            elements.append(Paragraph(f"&nbsp;&nbsp;&nbsp;<b>Why It Matters:</b> {g.get('why_it_matters')}", body_style))
            elements.append(Paragraph(f"&nbsp;&nbsp;&nbsp;<b>Recommended Verification:</b> <font color='#B8754D'>{g.get('recommended_step')}</font>", body_style))
            elements.append(Spacer(1, 4))
    else:
        elements.append(Paragraph("<i>No evidentiary gaps currently identified.</i>", body_style))
    elements.append(Spacer(1, 14))

    # Section 5: Forensics Notice and Legal Limitations
    elements.append(Paragraph("5. Forensic Notice & Limitations", h2_style))
    elements.append(Paragraph(
        "<b>Important Notice:</b> This report is generated by TrustTrace AI for forensic decision-support and audit facilitation. "
        "Automated observations reflect structural, cryptographic, and documentary consistency. They do not constitute a legal determination of fraud or criminal culpability. "
        "Reviewers should execute suggested verification steps with primary institutions before formal case closure.",
        body_style
    ))

    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()
