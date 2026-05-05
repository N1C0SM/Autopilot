import { Link } from "react-router-dom";
import { useParams } from "react-router-dom";

const CONTENT: Record<string, { title: string; body: string[] }> = {
  terminos: {
    title: "Términos y condiciones",
    body: [
      "Bienvenido a Autopilot. Al registrarte aceptas estos términos.",
      "El servicio incluye un plan personalizado de entrenamiento y nutrición, junto con acompañamiento por chat con un entrenador real.",
      "Suscripción mensual de 19€. Los primeros 7 días son gratuitos. Puedes cancelar en cualquier momento desde tu panel.",
      "Autopilot no sustituye consejo médico. Si tienes patologías, consulta con un profesional sanitario antes de empezar.",
      "Para soporte: contacto disponible desde el chat dentro de la app.",
    ],
  },
  privacidad: {
    title: "Política de privacidad",
    body: [
      "En Autopilot tratamos tus datos con la máxima confidencialidad y conforme al RGPD.",
      "Datos que recogemos: email, datos del cuestionario (objetivo, nivel, lesiones, horarios), historial de entrenamientos y nutrición, mensajes de chat.",
      "Usamos estos datos exclusivamente para personalizar tu plan y prestarte el servicio. No los compartimos con terceros con fines comerciales.",
      "Procesadores: Stripe (pagos), Lovable Cloud (hosting y base de datos), proveedor de email transaccional.",
      "Puedes solicitar acceso, rectificación o eliminación total de tus datos desde Configuración > Eliminar cuenta.",
    ],
  },
};

const Legal = () => {
  const { slug } = useParams();
  const data = CONTENT[slug || ""] || CONTENT.terminos;
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="container mx-auto h-16 flex items-center px-4">
          <Link to="/" className="font-display text-xl font-bold text-gradient">Autopilot</Link>
        </div>
      </nav>
      <main className="container mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-3xl font-bold font-display mb-8">{data.title}</h1>
        <div className="space-y-4 text-muted-foreground leading-relaxed">
          {data.body.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        <p className="text-xs text-muted-foreground mt-12">Última actualización: {new Date().toLocaleDateString("es-ES")}</p>
      </main>
    </div>
  );
};

export default Legal;