import io
import html
from datetime import datetime
from typing import Dict, Any, List

class PDFReportGenerator:
    """
    Enterprise PDF Originality Report Generator.
    Generates formal, publication-grade academic audit reports including:
      - Formal Institutional Header
      - Overall Plagiarism & Originality Metric Gauges
      - Matched Sources Summary Table
      - Full Document Body with Character-Accurate Visual Highlighting
    """

    @staticmethod
    def _slice_highlighted_html(full_text: str, matches: List[Dict[str, Any]]) -> str:
        """
        Slices full_text into non-overlapping plain and styled HTML spans
        based on exact start_index and end_index offsets.
        """
        if not full_text:
            return ""
        if not matches:
            return f"<p>{html.escape(full_text).replace(chr(10), '<br/>')}</p>"

        text_len = len(full_text)
        boundary_set = set([0, text_len])
        for m in matches:
            s = max(0, min(m.get("start_index", 0), text_len))
            e = max(0, min(m.get("end_index", text_len), text_len))
            if s < e:
                boundary_set.add(s)
                boundary_set.add(e)

        sorted_points = sorted(list(boundary_set))
        html_chunks = []

        for i in range(len(sorted_points) - 1):
            p_start = sorted_points[i]
            p_end = sorted_points[i + 1]
            slice_text = html.escape(full_text[p_start:p_end])
            slice_formatted = slice_text.replace("\n", "<br/>")

            # Check covering matches
            covering = [
                m for m in matches 
                if m.get("start_index", 0) <= p_start and m.get("end_index", text_len) >= p_end
            ]

            if not covering:
                html_chunks.append(f"<span>{slice_formatted}</span>")
            else:
                # Pick primary match
                primary = max(covering, key=lambda x: x.get("similarity_score", 0))
                m_type = primary.get("match_type", "exact_copy")
                score_pct = int(primary.get("similarity_score", 1.0) * 100)

                if m_type == "exact_copy" or primary.get("similarity_score", 0) >= 0.92:
                    bg_color = "#fee2e2"  # Rose / Light Red
                    border_color = "#ef4444"
                    label_color = "#991b1b"
                elif m_type == "paraphrase":
                    bg_color = "#fef3c7"  # Amber
                    border_color = "#f59e0b"
                    label_color = "#92400e"
                else:
                    bg_color = "#e0f2fe"  # Blue (Web)
                    border_color = "#0284c7"
                    label_color = "#075985"

                html_chunks.append(
                    f'<span style="background-color: {bg_color}; border-bottom: 2px solid {border_color}; '
                    f'padding: 1px 3px; border-radius: 3px; color: #0f172a;" '
                    f'title="{primary.get("source_title", "Source")} ({score_pct}%)">{slice_formatted}</span>'
                )

        return "".join(html_chunks)

    @classmethod
    def generate_html_template(
        cls,
        report_data: Dict[str, Any],
        user_email: str,
        filename: str,
        scan_id: str
    ) -> str:
        """Constructs an elegant, print-ready HTML document for conversion to PDF."""
        overall_score = float(report_data.get("overall_score", 0.0))
        originality_score = float(report_data.get("originality_score", 100.0 - overall_score))
        total_words = report_data.get("total_words", 0)
        total_chars = report_data.get("total_characters", len(report_data.get("full_text", "")))
        matches = report_data.get("matches", [])
        full_text = report_data.get("full_text", "")
        scan_date = datetime.now().strftime("%B %d, %Y - %H:%M UTC")

        # Color theme based on score severity
        if overall_score < 20:
            score_color = "#10b981"  # Emerald
            score_bg = "#ecfdf5"
            severity_label = "LOW SIMILARITY - ORIGINAL"
        elif overall_score <= 40:
            score_color = "#f59e0b"  # Amber
            score_bg = "#fffbeb"
            severity_label = "MODERATE OVERLAP - REVIEW RECOMMENDED"
        else:
            score_color = "#e11d48"  # Rose
            score_bg = "#fff1f2"
            severity_label = "HIGH PLAGIARISM DETECTED"

        # Generate styled source table rows
        source_rows = []
        for idx, m in enumerate(matches, 1):
            pct = int(m.get("similarity_score", 0) * 100)
            m_type = m.get("match_type", "exact_copy").replace("_", " ").upper()
            title = html.escape(m.get("source_title", "Unknown Source"))
            url = m.get("source_url")
            link_html = f'<a href="{url}" style="color: #4f46e5; text-decoration: none;">{html.escape(url[:55])}...</a>' if url else f'<span style="color: #64748b;">ID: {html.escape(m.get("source_id", "Internal DB"))}</span>'

            source_rows.append(f"""
            <tr style="border-bottom: 1px solid #e2e8f0; font-size: 11px;">
                <td style="padding: 8px; font-weight: bold; width: 30px;">#{idx}</td>
                <td style="padding: 8px;">
                    <strong>{title}</strong><br/>
                    {link_html}
                </td>
                <td style="padding: 8px; width: 100px;">
                    <span style="background-color: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold;">{m_type}</span>
                </td>
                <td style="padding: 8px; font-weight: bold; color: #0f172a; text-align: right; width: 70px;">{pct}%</td>
            </tr>
            """)

        sources_table_content = "".join(source_rows) if source_rows else '<tr><td colspan="4" style="padding: 12px; text-align: center; color: #10b981;">No matching sources found. Document is 100% original.</td></tr>'

        # Highlighted text body
        highlighted_body = cls._slice_highlighted_html(full_text, matches)

        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8"/>
            <title>Originality Report - {html.escape(filename)}</title>
            <style>
                @page {{
                    size: A4;
                    margin: 20mm 15mm 20mm 15mm;
                    @top-left {{
                        content: "OriginalityGuard Academic Verification Audit";
                        font-size: 8px;
                        color: #94a3b8;
                    }}
                    @top-right {{
                        content: "{html.escape(filename)}";
                        font-size: 8px;
                        color: #94a3b8;
                    }}
                    @bottom-center {{
                        content: "Page " counter(page) " of " counter(pages);
                        font-size: 8px;
                        color: #94a3b8;
                    }}
                }}

                body {{
                    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                    color: #1e293b;
                    line-height: 1.5;
                    font-size: 12px;
                }}

                .header-card {{
                    border-bottom: 2px solid #4f46e5;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }}

                .title {{
                    font-size: 20px;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 0;
                }}

                .sub-title {{
                    font-size: 10px;
                    color: #64748b;
                    margin-top: 4px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }}

                .meta-table {{
                    width: 100%;
                    margin-top: 10px;
                    font-size: 11px;
                }}

                .score-banner {{
                    background-color: {score_bg};
                    border: 2px solid {score_color};
                    border-radius: 8px;
                    padding: 15px;
                    margin-bottom: 25px;
                    display: table;
                    width: 100%;
                }}

                .score-cell {{
                    display: table-cell;
                    vertical-align: middle;
                }}

                .score-number {{
                    font-size: 38px;
                    font-weight: 900;
                    color: {score_color};
                    line-height: 1;
                }}

                .badge {{
                    display: inline-block;
                    background-color: {score_color};
                    color: white;
                    padding: 3px 8px;
                    border-radius: 4px;
                    font-size: 9px;
                    font-weight: bold;
                    letter-spacing: 0.5px;
                }}

                .section-heading {{
                    font-size: 13px;
                    font-weight: bold;
                    color: #0f172a;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #cbd5e1;
                    padding-bottom: 4px;
                    margin-top: 25px;
                    margin-bottom: 12px;
                }}

                table.sources-table {{
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 25px;
                }}

                table.sources-table th {{
                    background-color: #f8fafc;
                    padding: 8px;
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #64748b;
                    border-bottom: 1px solid #cbd5e1;
                }}

                .document-body {{
                    font-family: 'Georgia', Times, serif;
                    font-size: 11.5px;
                    line-height: 1.7;
                    color: #1e293b;
                    background-color: #fafafa;
                    border: 1px solid #e2e8f0;
                    border-radius: 6px;
                    padding: 20px;
                    margin-top: 10px;
                    text-align: justify;
                }}

                .legend {{
                    margin-top: 10px;
                    margin-bottom: 20px;
                    font-size: 10px;
                }}
            </style>
        </head>
        <body>
            <!-- Header Section -->
            <div class="header-card">
                <table style="width: 100%;">
                    <tr>
                        <td>
                            <div class="title">OriginalityGuard</div>
                            <div class="sub-title">Academic Integrity & Plagiarism Audit Report</div>
                        </td>
                        <td style="text-align: right;">
                            <span style="font-size: 10px; color: #64748b;">Report ID: <strong>{html.escape(scan_id[:8])}</strong></span><br/>
                            <span style="font-size: 10px; color: #64748b;">Generated: <strong>{scan_date}</strong></span>
                        </td>
                    </tr>
                </table>

                <table class="meta-table">
                    <tr>
                        <td><strong>Document Filename:</strong> {html.escape(filename)}</td>
                        <td><strong>Audited User:</strong> {html.escape(user_email)}</td>
                    </tr>
                    <tr>
                        <td><strong>Word Count:</strong> {total_words} words</td>
                        <td><strong>Character Count:</strong> {total_chars} characters</td>
                    </tr>
                </table>
            </div>

            <!-- Score Banner -->
            <div class="score-banner">
                <table style="width: 100%;">
                    <tr>
                        <td style="width: 35%; border-right: 1px solid #cbd5e1; padding-right: 20px;">
                            <div class="score-number">{overall_score}%</div>
                            <div style="font-size: 10px; text-transform: uppercase; font-weight: bold; color: #64748b; margin-top: 4px;">
                                Overall Similarity Index
                            </div>
                        </td>
                        <td style="padding-left: 20px;">
                            <div class="badge">{severity_label}</div>
                            <div style="font-size: 11px; color: #334155; margin-top: 6px;">
                                Originality Coefficient: <strong>{originality_score}% Original Content</strong><br/>
                                Total Matched Sources: <strong>{len(matches)} primary clusters identified</strong>
                            </div>
                        </td>
                    </tr>
                </table>
            </div>

            <!-- Matched Sources Table -->
            <div class="section-heading">1. Matched Sources Summary ({len(matches)} Sources)</div>
            <table class="sources-table">
                <thead>
                    <tr>
                        <th style="text-align: left;">#</th>
                        <th style="text-align: left;">Source Name & Link</th>
                        <th style="text-align: left;">Match Type</th>
                        <th style="text-align: right;">Similarity</th>
                    </tr>
                </thead>
                <tbody>
                    {sources_table_content}
                </tbody>
            </table>

            <!-- Highlight Legend -->
            <div class="legend">
                <strong>Highlight Legend:</strong> &nbsp;
                <span style="background-color: #fee2e2; border-bottom: 2px solid #ef4444; padding: 2px 6px;">Exact Match Copy</span> &nbsp;&nbsp;
                <span style="background-color: #fef3c7; border-bottom: 2px solid #f59e0b; padding: 2px 6px;">Paraphrased Content</span> &nbsp;&nbsp;
                <span style="background-color: #e0f2fe; border-bottom: 2px solid #0284c7; padding: 2px 6px;">Internet Web Source</span>
            </div>

            <!-- Full Document Content with Highlights -->
            <div class="section-heading">2. Full Document Text with Highlighted Matches</div>
            <div class="document-body">
                {highlighted_body}
            </div>
        </body>
        </html>
        """

    @classmethod
    def generate_pdf_bytes(
        cls,
        report_data: Dict[str, Any],
        user_email: str,
        filename: str,
        scan_id: str
    ) -> bytes:
        """
        Renders HTML/CSS into a high-resolution PDF byte buffer using xhtml2pdf or ReportLab.
        """
        html_content = cls.generate_html_template(
            report_data=report_data,
            user_email=user_email,
            filename=filename,
            scan_id=scan_id
        )

        pdf_buffer = io.BytesIO()

        # Primary engine: xhtml2pdf (HTML/CSS to PDF)
        try:
            from xhtml2pdf import pisa
            pisa_status = pisa.CreatePDF(
                src=html_content,
                dest=pdf_buffer,
                encoding="utf-8"
            )
            if not pisa_status.err:
                return pdf_buffer.getvalue()
        except ImportError:
            pass
        except Exception:
            pdf_buffer = io.BytesIO()  # Reset buffer on failure

        # Fallback engine: ReportLab programmatic canvas builder
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib import colors

        doc = SimpleDocTemplate(pdf_buffer, pagesize=letter, rightMargin=40, leftMargin=40, topMargin=40, bottomMargin=40)
        styles = getSampleStyleSheet()
        elements = []

        # Title
        elements.append(Paragraph("<b>OriginalityGuard Plagiarism Audit Report</b>", styles["Title"]))
        elements.append(Spacer(1, 10))

        # Metadata
        overall_score = report_data.get("overall_score", 0.0)
        meta_text = (
            f"<b>Document:</b> {filename}<br/>"
            f"<b>Audited User:</b> {user_email}<br/>"
            f"<b>Overall Similarity Index:</b> <font color='red'><b>{overall_score}%</b></font><br/>"
            f"<b>Originality:</b> <b>{100.0 - overall_score}%</b><br/>"
            f"<b>Generated:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        )
        elements.append(Paragraph(meta_text, styles["Normal"]))
        elements.append(Spacer(1, 15))

        # Matched Sources
        elements.append(Paragraph("<b>Matched Reference Sources</b>", styles["Heading2"]))
        matches = report_data.get("matches", [])
        table_data = [["#", "Source Title", "Type", "Similarity"]]
        for i, m in enumerate(matches, 1):
            table_data.append([
                str(i),
                m.get("source_title", "Unknown")[:40],
                m.get("match_type", "").upper(),
                f"{int(m.get('similarity_score', 0) * 100)}%"
            ])

        t = Table(table_data, colWidths=[30, 260, 100, 80])
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#f1f5f9')),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#cbd5e1'))
        ]))
        elements.append(t)
        elements.append(Spacer(1, 15))

        # Full Document Text
        elements.append(Paragraph("<b>Document Text</b>", styles["Heading2"]))
        elements.append(Paragraph(report_data.get("full_text", "").replace("\n", "<br/>"), styles["BodyText"]))

        doc.build(elements)
        return pdf_buffer.getvalue()
