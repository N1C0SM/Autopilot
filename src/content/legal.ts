/**
 * Borradores de documentos legales para Autopilot.
 * IMPORTANTE: revisar con abogado / DPO antes de publicar definitivamente.
 */

export const LEGAL_VERSION = "1.0";
export const LEGAL_LAST_UPDATED = "18 de junio de 2026";

const COMPANY = {
  brand: "Autopilot",
  domain: "autopilotplan.com",
  contactEmail: "hola@autopilotplan.com",
  dpoEmail: "privacidad@autopilotplan.com",
};

export type LegalSlug =
  | "terminos"
  | "privacidad"
  | "cookies"
  | "aviso-legal"
  | "disclaimer-medico";

type Section = {
  heading?: string;
  paragraphs?: string[];
  list?: string[];
};

type LegalDoc = {
  title: string;
  summary: string;
  sections: Section[];
};

export const LEGAL_DOCS: Record<LegalSlug, LegalDoc> = {
  // ───────────────────────────────────────────── PRIVACIDAD
  privacidad: {
    title: "Política de Privacidad",
    summary:
      "Cómo recogemos, usamos y protegemos tus datos personales y de salud en Autopilot, conforme al RGPD y la LOPDGDD.",
    sections: [
      {
        heading: "1. Responsable del tratamiento",
        paragraphs: [
          `El responsable del tratamiento es ${COMPANY.brand} (en adelante, "nosotros" o "el Servicio"), accesible en ${COMPANY.domain}.`,
          `Para cualquier cuestión sobre tus datos personales puedes contactarnos en ${COMPANY.dpoEmail} o ${COMPANY.contactEmail}.`,
          "Los datos de identificación fiscal completos del responsable se encuentran disponibles en el Aviso Legal.",
        ],
      },
      {
        heading: "2. Qué datos tratamos",
        paragraphs: [
          "Recogemos únicamente los datos necesarios para prestarte el servicio. Distinguimos entre datos comunes y datos de categoría especial (datos de salud).",
        ],
        list: [
          "Datos de identificación y cuenta: nombre, email, contraseña cifrada, foto de perfil opcional.",
          "Datos de salud y físicos (categoría especial, Art. 9 RGPD): edad, sexo, altura, peso, objetivos físicos, nivel de actividad, lesiones, patologías declaradas, alergias y restricciones alimentarias.",
          "Datos de uso del servicio: respuestas al onboarding, plan de entrenamiento y nutrición generado, registros de sesiones, pesos levantados, fotos de progreso opcionales.",
          "Comunicaciones: mensajes intercambiados con tu entrenador a través del chat de la app.",
          "Datos de pago: gestionados íntegramente por Stripe. Nosotros solo conservamos el identificador de cliente y el estado de la suscripción, nunca el número de tarjeta.",
          "Datos técnicos: dirección IP, tipo de dispositivo y navegador, registros de acceso, datos de errores. Se utilizan exclusivamente para seguridad y depuración.",
        ],
      },
      {
        heading: "3. Base jurídica del tratamiento",
        list: [
          "Ejecución de contrato (Art. 6.1.b RGPD): para crear y mantener tu cuenta, generar tus planes, procesar pagos y prestar soporte.",
          "Consentimiento explícito (Art. 9.2.a RGPD): para el tratamiento de tus datos de salud con fines de personalización del plan. Este consentimiento se recoge de forma específica e independiente durante el onboarding y puedes retirarlo en cualquier momento.",
          "Interés legítimo (Art. 6.1.f RGPD): para prevención de fraude, seguridad de la plataforma y mejora del servicio mediante análisis agregados y anonimizados.",
          "Obligación legal (Art. 6.1.c RGPD): para conservar facturación y atender requerimientos de autoridades competentes.",
        ],
      },
      {
        heading: "4. Decisiones automatizadas e inteligencia artificial",
        paragraphs: [
          "Autopilot utiliza modelos de inteligencia artificial para asistir en la elaboración del diagnóstico inicial y del plan personalizado. Sin embargo, toda recomendación es revisada y validada por un entrenador humano titulado antes de ser entregada al usuario. No se toman decisiones puramente automatizadas con efectos jurídicos o significativos sobre ti en el sentido del Art. 22 RGPD.",
          "Tienes derecho a solicitar intervención humana, expresar tu punto de vista e impugnar cualquier recomendación enviando un mensaje a tu entrenador desde el chat o escribiendo a " + COMPANY.dpoEmail + ".",
        ],
      },
      {
        heading: "5. Conservación de los datos",
        list: [
          "Datos de cuenta y planes: mientras tu cuenta esté activa y hasta 30 días tras su eliminación, salvo obligaciones legales de conservación.",
          "Fotos de progreso: hasta 12 meses desde su subida o hasta que las elimines tú mismo, lo que ocurra antes.",
          "Mensajes de chat: durante toda la vigencia de la cuenta. Tras la baja se eliminan en un plazo máximo de 30 días.",
          "Facturación: 6 años conforme a la normativa fiscal española.",
          "Datos de pago en Stripe: regidos por la política de retención de Stripe.",
        ],
      },
      {
        heading: "6. Encargados de tratamiento y transferencias",
        paragraphs: [
          "Para prestar el servicio compartimos parte de tus datos con los siguientes proveedores, todos ellos vinculados mediante contratos de encargado de tratamiento (Art. 28 RGPD):",
        ],
        list: [
          "Lovable Cloud (Supabase): alojamiento de base de datos, autenticación, almacenamiento de archivos y funciones serverless.",
          "Lovable AI Gateway: acceso a modelos de IA (Google Gemini) para el diagnóstico y la generación inicial del plan. Los datos se envían anonimizados y sin identificadores directos siempre que es técnicamente posible.",
          "Stripe Payments Europe, Ltd.: procesamiento de pagos y gestión de la suscripción.",
          "Proveedor de email transaccional (Mailgun / equivalente): envío de avisos automatizados, recuperación de contraseña y notificaciones.",
          "Google Calendar (opcional): si el usuario activa la sincronización, se genera un calendario ICS al que se conecta su cuenta de Google.",
        ],
        // segundo bloque dentro de la misma sección
      },
      {
        paragraphs: [
          "Algunos de estos proveedores pueden tratar datos fuera del Espacio Económico Europeo. En esos casos, las transferencias se realizan al amparo de las Cláusulas Contractuales Tipo aprobadas por la Comisión Europea y/u otras garantías equivalentes previstas en el RGPD.",
        ],
      },
      {
        heading: "7. Tus derechos",
        paragraphs: [
          "Puedes ejercer en cualquier momento los derechos de acceso, rectificación, supresión, limitación, oposición y portabilidad de tus datos, así como retirar tu consentimiento.",
        ],
        list: [
          `Desde la propia app: Configuración → Privacidad → Exportar mis datos / Eliminar cuenta.`,
          `Por email: ${COMPANY.dpoEmail}, indicando el derecho que deseas ejercer.`,
          "Tienes derecho a presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es) si consideras que el tratamiento no se ajusta a la normativa.",
        ],
      },
      {
        heading: "8. Seguridad",
        paragraphs: [
          "Aplicamos medidas técnicas y organizativas razonables y proporcionales al riesgo: cifrado en tránsito (TLS), cifrado en reposo de la base de datos, control de acceso por roles, autenticación segura, registros de auditoría y revisiones periódicas.",
          "Ningún sistema es 100% infalible. En caso de incidente de seguridad que pudiera afectarte, te lo notificaremos sin dilación indebida conforme al Art. 34 RGPD.",
        ],
      },
      {
        heading: "9. Menores",
        paragraphs: [
          "Autopilot no está dirigido a menores de 16 años. No tratamos conscientemente datos de menores de esa edad. Si detectamos una cuenta de un menor sin consentimiento parental válido, procederemos a su eliminación.",
        ],
      },
      {
        heading: "10. Cambios en esta política",
        paragraphs: [
          "Podemos actualizar esta política cuando lo requieran cambios legales o del servicio. Te avisaremos por email o dentro de la app antes de que los cambios sustanciales entren en vigor.",
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── TÉRMINOS
  terminos: {
    title: "Términos y Condiciones",
    summary:
      "Condiciones de uso del servicio Autopilot: qué incluye, cómo se contrata, cancelación, garantías y responsabilidades.",
    sections: [
      {
        heading: "1. Aceptación",
        paragraphs: [
          `Al registrarte y/o contratar cualquier plan de ${COMPANY.brand} aceptas íntegramente estos Términos y Condiciones, junto con la Política de Privacidad y la Política de Cookies.`,
          "Si no estás de acuerdo con alguno de los puntos, no debes utilizar el servicio.",
        ],
      },
      {
        heading: "2. Descripción del servicio",
        paragraphs: [
          "Autopilot es un servicio de coaching fitness online consistente en (i) un diagnóstico físico inicial asistido por IA, (ii) un plan personalizado de entrenamiento y, opcionalmente, de nutrición elaborado y supervisado por un entrenador humano titulado, y (iii) seguimiento por chat con dicho entrenador.",
          "El servicio NO sustituye al consejo médico, fisioterapéutico ni a la prescripción de profesionales sanitarios. Ver el Disclaimer médico para más detalle.",
        ],
      },
      {
        heading: "3. Requisitos del usuario",
        list: [
          "Tener al menos 16 años de edad. Los menores de 18 años necesitan autorización de su representante legal para contratar la suscripción.",
          "Declarar de buena fe tu estado físico, lesiones y patologías relevantes en el onboarding.",
          "Consultar previamente con un médico si padeces cualquier patología cardiovascular, metabólica, articular grave o estás embarazada.",
        ],
      },
      {
        heading: "4. Planes y precios",
        list: [
          "Entrenamiento: 29 €/mes. Plan de entrenamiento personalizado y chat con el entrenador.",
          "Completo: 49 €/mes. Entrenamiento + plan de nutrición + chat.",
          "Transformación 12 semanas: 299 € pago único. Programa intensivo con llamada de seguimiento.",
          "Primera semana gratis en los planes mensuales. No se cobra nada si cancelas antes del día 7.",
          "Los precios incluyen los impuestos aplicables. Cualquier cambio futuro se comunicará con al menos 30 días de antelación.",
        ],
      },
      {
        heading: "5. Contratación, renovación y cancelación",
        paragraphs: [
          "La suscripción se contrata a través de Stripe. Se renueva automáticamente cada mes hasta que la canceles.",
          "Puedes cancelar en cualquier momento desde Configuración → Suscripción, sin permanencia ni penalización. Mantendrás el acceso al servicio hasta el final del periodo ya pagado.",
        ],
      },
      {
        heading: "6. Derecho de desistimiento",
        paragraphs: [
          "Como consumidor tienes 14 días naturales para desistir del contrato sin necesidad de justificación, conforme al Real Decreto Legislativo 1/2007.",
          "No obstante, al aceptar estos términos solicitas expresamente que el servicio comience inmediatamente. Por tanto, si utilizas el servicio (recibes tu plan personalizado, chateas con el entrenador, etc.) reconoces que pierdes el derecho de desistimiento una vez ejecutado el servicio en su totalidad, conforme al Art. 103.a del mismo texto refundido.",
          "La prueba gratuita de 7 días te permite evaluar el servicio sin coste antes de cualquier cobro.",
        ],
      },
      {
        heading: "7. Reembolsos",
        paragraphs: [
          "Garantía de 30 días: si no estás satisfecho con el servicio recibido en los primeros 30 días desde el primer cobro, puedes solicitar un reembolso íntegro escribiendo a " + COMPANY.contactEmail + ". Tras ese plazo no se reembolsan periodos ya consumidos.",
          "El programa de Transformación 12 semanas, al ser pago único intensivo, sólo admite reembolso dentro de los primeros 14 días desde la compra y siempre que no hayas asistido a la llamada de bienvenida.",
        ],
      },
      {
        heading: "8. Obligaciones del usuario",
        list: [
          "Proporcionar información veraz y mantenerla actualizada.",
          "No compartir tu cuenta con terceros.",
          "No utilizar el servicio para fines ilícitos, ofensivos o que puedan dañar a otros usuarios o al propio servicio.",
          "Respetar el trato profesional con el entrenador. Nos reservamos el derecho a suspender cuentas con comportamientos abusivos.",
        ],
      },
      {
        heading: "9. Propiedad intelectual",
        paragraphs: [
          "Los planes, contenidos, marcas, código y diseño del servicio son propiedad de Autopilot o de sus licenciantes. Se te concede una licencia personal, no exclusiva e intransferible para usar el servicio con fines propios y no comerciales.",
          "No puedes reproducir, redistribuir, vender ni utilizar los planes para entrenar a terceros sin autorización por escrito.",
        ],
      },
      {
        heading: "10. Limitación de responsabilidad",
        paragraphs: [
          "Autopilot ofrece el servicio 'tal cual' y no garantiza resultados específicos, dado que dependen de factores personales fuera de nuestro control (genética, descanso, alimentación, constancia, etc.).",
          "No nos hacemos responsables de lesiones, dolencias o daños derivados de un uso inadecuado del plan, de la ocultación de información médica relevante o de la falta de consulta con profesionales sanitarios cuando hubiera sido prudente hacerlo.",
          "En cualquier caso, nuestra responsabilidad total frente a ti queda limitada al importe pagado en los 12 meses anteriores al evento que origine la reclamación.",
        ],
      },
      {
        heading: "11. Modificaciones",
        paragraphs: [
          "Podemos modificar estos términos por motivos legales, operativos o de mejora del servicio. Te notificaremos con al menos 15 días de antelación los cambios sustanciales por email o dentro de la app. Si no estás de acuerdo, puedes cancelar tu suscripción antes de que entren en vigor.",
        ],
      },
      {
        heading: "12. Ley aplicable y jurisdicción",
        paragraphs: [
          "Estos Términos se rigen por la legislación española. Para cualquier controversia, las partes se someten a los Juzgados y Tribunales del domicilio del consumidor cuando éste sea un usuario residente en España.",
          "También puedes acudir a la plataforma europea de resolución de litigios en línea: https://ec.europa.eu/consumers/odr.",
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── COOKIES
  cookies: {
    title: "Política de Cookies",
    summary:
      "Información sobre las cookies y tecnologías similares que utiliza Autopilot, conforme al Art. 22.2 de la LSSI-CE.",
    sections: [
      {
        heading: "1. Qué es una cookie",
        paragraphs: [
          "Una cookie es un pequeño fichero que se descarga en tu dispositivo al acceder a determinadas páginas web. Permiten reconocerte, recordar preferencias y, en algunos casos, analizar tu comportamiento en el sitio.",
        ],
      },
      {
        heading: "2. Cookies que utilizamos",
        paragraphs: [
          "Autopilot utiliza el menor número de cookies posible y prioriza las estrictamente necesarias.",
        ],
        list: [
          "Técnicas / esenciales (no requieren consentimiento): autenticación de sesión, mantenimiento del carrito de checkout, protección frente a ataques de seguridad. Sin ellas el servicio no funciona.",
          "Funcionales: recordar preferencias como el idioma o el modo claro/oscuro.",
          "Analíticas (opcionales): nos ayudan a entender de forma agregada y anonimizada cómo se usa la app para mejorarla. Sólo se cargan si las aceptas.",
        ],
      },
      {
        heading: "3. Cookies de terceros",
        list: [
          "Stripe: cookies necesarias para el procesamiento seguro de pagos y la prevención del fraude.",
          "Lovable Cloud: cookies técnicas asociadas a la sesión autenticada del usuario.",
        ],
      },
      {
        heading: "4. Cómo gestionar tus preferencias",
        paragraphs: [
          "Al entrar por primera vez al sitio se te muestra un banner desde el que puedes aceptar, rechazar o personalizar el uso de cookies no esenciales. Puedes cambiar tu decisión en cualquier momento desde el enlace 'Preferencias de cookies' del pie de página.",
          "También puedes bloquear o eliminar cookies directamente desde la configuración de tu navegador (Chrome, Safari, Firefox, Edge, etc.). Ten en cuenta que deshabilitar las cookies técnicas puede impedir el correcto funcionamiento del servicio.",
        ],
      },
      {
        heading: "5. Actualizaciones",
        paragraphs: [
          "Esta política puede actualizarse para reflejar cambios técnicos o normativos. La versión vigente siempre estará disponible en esta URL.",
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── AVISO LEGAL
  "aviso-legal": {
    title: "Aviso Legal",
    summary:
      "Información del titular del sitio web conforme a la Ley 34/2002 de Servicios de la Sociedad de la Información (LSSI-CE).",
    sections: [
      {
        heading: "1. Titular del sitio web",
        paragraphs: [
          `Este sitio web es titularidad de ${COMPANY.brand}, accesible en https://${COMPANY.domain}.`,
          "Los datos identificativos completos (denominación social, NIF, domicilio y, en su caso, datos de inscripción registral) deben completarse por el titular antes de la publicación definitiva.",
          `Contacto: ${COMPANY.contactEmail}.`,
        ],
      },
      {
        heading: "2. Objeto",
        paragraphs: [
          "El presente Aviso Legal regula el acceso y uso del sitio web y de los servicios ofrecidos a través del mismo. El uso del sitio atribuye la condición de Usuario e implica la aceptación de las presentes condiciones.",
        ],
      },
      {
        heading: "3. Propiedad intelectual e industrial",
        paragraphs: [
          "Todos los contenidos del sitio (textos, imágenes, diseño, código fuente, marcas, logotipos, etc.) están protegidos por derechos de propiedad intelectual e industrial, titularidad del prestador o de sus licenciantes.",
          "Queda prohibida su reproducción, distribución, transformación o comunicación pública sin autorización expresa.",
        ],
      },
      {
        heading: "4. Responsabilidad",
        paragraphs: [
          "El prestador no se hace responsable de los daños o perjuicios que pudieran derivarse del uso indebido del sitio, de la falta de disponibilidad temporal por causas técnicas o de la presencia de virus u otros elementos lesivos en los contenidos.",
          "Los enlaces a sitios de terceros se ofrecen únicamente por conveniencia del usuario y no implican recomendación ni responsabilidad sobre dichos sitios.",
        ],
      },
      {
        heading: "5. Legislación aplicable",
        paragraphs: [
          "El presente Aviso Legal se rige por la legislación española. Para cualquier controversia será competente la jurisdicción del domicilio del consumidor cuando éste resida en España.",
        ],
      },
    ],
  },

  // ───────────────────────────────────────────── DISCLAIMER MÉDICO
  "disclaimer-medico": {
    title: "Disclaimer médico y deportivo",
    summary:
      "Autopilot no sustituye el consejo de profesionales sanitarios. Lee este aviso antes de empezar cualquier plan.",
    sections: [
      {
        heading: "1. Naturaleza del servicio",
        paragraphs: [
          "Autopilot es un servicio de coaching fitness y nutricional orientado a personas adultas sanas. Las recomendaciones se elaboran combinando un análisis asistido por inteligencia artificial y la supervisión de un entrenador titulado.",
          "El servicio NO constituye consulta médica, diagnóstico clínico, fisioterapia, prescripción dietética hospitalaria ni tratamiento de patología alguna.",
        ],
      },
      {
        heading: "2. Consulta médica previa",
        paragraphs: [
          "Te recomendamos encarecidamente consultar con tu médico antes de iniciar cualquier programa de entrenamiento o cambio nutricional, especialmente si:",
        ],
        list: [
          "Padeces patologías cardiovasculares, metabólicas (diabetes, hipertensión, dislipemia) o respiratorias.",
          "Tienes lesiones articulares, musculares o has sido operado recientemente.",
          "Estás embarazada, en posparto o lactancia.",
          "Tomas medicación que pueda interactuar con la actividad física o con los macronutrientes.",
          "Tienes un Trastorno de la Conducta Alimentaria diagnosticado o sospechado.",
          "Eres mayor de 60 años o has llevado vida sedentaria durante un periodo prolongado.",
        ],
      },
      {
        heading: "3. Uso responsable",
        list: [
          "Sigue las indicaciones del plan respetando técnicas, cargas e intensidades sugeridas.",
          "Detén cualquier ejercicio que provoque dolor agudo o molestias inusuales y consulta con un profesional sanitario.",
          "Informa al entrenador a través del chat de cualquier cambio relevante en tu estado de salud.",
          "Hidrátate adecuadamente y respeta los descansos.",
        ],
      },
      {
        heading: "4. Uso de IA y supervisión humana",
        paragraphs: [
          "Parte del análisis y la generación del plan se apoya en modelos de inteligencia artificial. Cada plan es revisado por un entrenador humano titulado antes de ser entregado, y cualquier ajuste posterior se realiza también con su intervención.",
          "Aun así, ninguna recomendación generada por IA puede considerarse infalible. Aplica siempre tu propio criterio y, ante cualquier duda, consulta con un profesional sanitario.",
        ],
      },
      {
        heading: "5. Limitación de responsabilidad",
        paragraphs: [
          "Autopilot no se hace responsable de lesiones, dolencias o daños derivados del incumplimiento de este disclaimer, de la ocultación de información médica relevante, del uso inadecuado del plan o de no haber consultado previamente con un profesional cuando hubiera sido prudente.",
        ],
      },
    ],
  },
};