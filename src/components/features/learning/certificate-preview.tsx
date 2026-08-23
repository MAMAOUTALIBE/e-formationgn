import { BRAND } from "@/lib/brand";
import {
  type CertificateTemplateData,
  formatCertificateDate,
} from "@/lib/certificate-template";

import styles from "./certificate-preview.module.css";

interface CertificatePreviewProps {
  data: CertificateTemplateData;
  showModel?: boolean;
}

export function CertificatePreview({ data, showModel = true }: CertificatePreviewProps) {
  return (
    <div className={styles.viewport} aria-label="Aperçu de l’attestation au format A4 paysage">
      <article className={styles.sheet} data-testid="certificate-preview">
        <div className={styles.innerFrame} />
        <span className={`${styles.corner} ${styles.topLeft}`} aria-hidden>❧</span>
        <span className={`${styles.corner} ${styles.topRight}`} aria-hidden>❧</span>
        <span className={`${styles.corner} ${styles.bottomRight}`} aria-hidden>❧</span>
        <span className={`${styles.corner} ${styles.bottomLeft}`} aria-hidden>❧</span>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className={styles.watermark} src={BRAND.logoUrl} alt="" aria-hidden />

        <div className={styles.content}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src={BRAND.logoUrl} alt="Aiduca" />
          {showModel ? <p className={styles.model}>MODÈLE</p> : null}
          <h2 className={styles.title}>Attestation de fin de formation</h2>
          <div className={styles.ornament} aria-hidden>• ❧ •</div>

          <div className={styles.body}>
            <p>L’Institut AIDUCA atteste que</p>
            <p>
              M./Mme : <span className={styles.recipient}>{data.recipientName}</span>
            </p>
            <p>a suivi avec assiduité la formation :</p>
            <p className={styles.course}>« {data.courseTitle} »</p>
            <p>Durée : {data.durationLabel}</p>
            {data.objectives && data.objectives.length > 0 ? (
              <div className={styles.legalBlock}>
                <p className={styles.legalLabel}>Objectifs de la formation</p>
                <ul className={styles.objectives}>
                  {data.objectives.map((objectif) => (
                    <li key={objectif}>{objectif}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {data.assessmentSummary ? (
              <div className={styles.legalBlock}>
                <p className={styles.legalLabel}>Résultats de l’évaluation des acquis</p>
                <p className={styles.assessment}>{data.assessmentSummary}</p>
              </div>
            ) : null}
            <p>
              Du : <strong>{formatCertificateDate(data.startDate)}</strong> au :{" "}
              <strong>{formatCertificateDate(data.endDate)}</strong>
            </p>
            <p>Lieu : <strong>{data.trainingLocation}</strong></p>
            <p className={styles.issued}>
              Fait à Montrouge, le <strong>{formatCertificateDate(data.issuedAt)}</strong>
            </p>
          </div>

          <div className={styles.signatures}>
            <div>
              <p>Le responsable de formation</p>
              <div className={styles.signatureLine} />
            </div>
            <div className={styles.seal} aria-hidden>❧</div>
            <div>
              <p>Signature du stagiaire</p>
              <div className={styles.signatureLine} />
            </div>
          </div>

          <footer className={styles.footer}>
            <p>Institut AIDUCA — {BRAND.address}</p>
            <p className={styles.footerContact}>
              {BRAND.phone} • {BRAND.mobile} • {BRAND.email} • www.aiduca.fr
            </p>
          </footer>
        </div>
        {data.serialNumber ? (
          <p className={styles.reference}>Réf. {data.serialNumber}</p>
        ) : null}
      </article>
    </div>
  );
}
