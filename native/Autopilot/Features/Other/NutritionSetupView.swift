import SwiftUI
import Supabase

/// Onboarding de comidas de Plus, como `NutritionSetup` de la web. El onboarding general no
/// pregunta por comidas (el plan Gratis no las incluye): se piden aquí, la primera vez que
/// alguien con Plus abre Nutrición. Guarda las mismas columnas que la web. Titular, cuatro
/// bloques en Title 3 (solo la primera en mayúscula), fichas en dorado tenue y una acción dorada.
struct NutritionSetupView: View {
    let userId: UUID
    let onDone: () -> Void

    private static let cooking: [(v: String, l: String, d: String)] = [
        ("quick", "Rápido, sin complicarme", "Recetas de menos de 15 min"),
        ("normal", "Algo de cocina", "Platos sencillos y variados"),
        ("loves", "Me gusta cocinar", "Recetas más elaboradas"),
    ]
    private static let likesOptions = ["Pollo", "Ternera", "Pescado", "Huevos", "Arroz", "Pasta", "Patata", "Legumbres",
                                       "Verduras", "Fruta", "Yogur", "Avena", "Pan", "Frutos secos", "Tofu"]
    private static let avoidOptions = ["Lactosa", "Gluten", "Frutos secos", "Marisco", "Pescado", "Huevo", "Cerdo", "Carne roja",
                                       "Vegetariano", "Vegano", "Picante"]

    @State private var meals = 3
    @State private var cooking = "normal"
    @State private var likes: [String] = []
    @State private var dislikes: [String] = []
    @State private var avoid = ""
    @State private var saving = false
    @State private var failed = false

    var body: some View {
        VStack(alignment: .leading, spacing: 32) {
            VStack(alignment: .leading, spacing: 8) {
                (Text("Tus comidas, ") + Text("hechas para ti").foregroundColor(Palette.gold)).font(.apTitle1)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isHeader)
                Text("Cuatro preguntas y te preparamos las comidas de cada día, ajustadas a tus macros.")
                    .font(.apSubhead).foregroundStyle(Palette.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }

            group("Comidas al día") {
                HStack(spacing: 8) {
                    ForEach([2, 3, 4, 5], id: \.self) { n in
                        Button { Haptics.selection(); meals = n } label: {
                            Text("\(n)").font(.apHeadline.monospacedDigit()).frame(maxWidth: .infinity, minHeight: 48)
                                .foregroundStyle(meals == n ? Palette.gold : Palette.foreground)
                                .background(meals == n ? Palette.gold.opacity(0.15) : Palette.card, in: Capsule())
                                .contentShape(Capsule())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(n) comidas al día")
                        .accessibilityAddTraits(meals == n ? .isSelected : [])
                    }
                }
            }

            group("¿Te gusta cocinar?") {
                VStack(spacing: 0) {
                    ForEach(Array(Self.cooking.enumerated()), id: \.offset) { index, o in
                        if index > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
                        Button { Haptics.selection(); cooking = o.v } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(o.l).font(.apHeadline)
                                    Text(o.d).font(.apSubhead).foregroundStyle(Palette.muted)
                                }
                                Spacer()
                                Image(systemName: "checkmark").font(.apHeadline).foregroundStyle(Palette.gold).opacity(cooking == o.v ? 1 : 0)
                                    .accessibilityHidden(true)
                            }
                            .padding(.horizontal, 16).padding(.vertical, 8).frame(minHeight: 56).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .combine)
                        .accessibilityAddTraits(cooking == o.v ? .isSelected : [])
                    }
                }
                .surface()
            }

            group("¿Qué te gusta comer?") { chips(Self.likesOptions, selection: $likes) }
            group("¿Qué no comes?") { chips(Self.avoidOptions, selection: $dislikes) }
            group("¿Algo más que evitar?") {
                TextField("Opcional: avena, champiñones…", text: $avoid)
                    .font(.apBody)
                    .padding(.horizontal, 20).frame(minHeight: 52)
                    .background(Palette.secondary, in: Capsule())
                    .accessibilityLabel("Otros alimentos que no quieres ver (opcional)")
            }

            if failed {
                Text("No se pudo guardar. Revisa tu conexión e inténtalo otra vez.").font(.apFootnote).foregroundStyle(Palette.destructive)
            }
            Button { Task { await save() } } label: {
                HStack(spacing: 8) {
                    if saving { BrandLoader(color: Palette.background).accessibilityHidden(true) }
                    Text("Preparar mis comidas")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.pill)
            .disabled(saving)
        }
    }

    /// Bloque del cuestionario: título en Title 3 y su contenido (como `Group` en la web).
    private func group<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(.apTitle3).accessibilityAddTraits(.isHeader)
            content()
        }
    }

    /// Fichas de selección múltiple como `ChipGroup` en la web: a su medida, en dorado tenue con
    /// check si están marcadas.
    private func chips(_ options: [String], selection: Binding<[String]>) -> some View {
        FlowRow(spacing: 8) {
            ForEach(options, id: \.self) { o in
                let on = selection.wrappedValue.contains(o)
                Button {
                    Haptics.selection()
                    if on { selection.wrappedValue.removeAll { $0 == o } } else { selection.wrappedValue.append(o) }
                } label: {
                    HStack(spacing: 6) {
                        if on { Image(systemName: "checkmark").font(.system(size: 13, weight: .bold)).accessibilityHidden(true) }
                        Text(o).font(.apSubhead.weight(.medium)).lineLimit(1)
                    }
                    .padding(.horizontal, 16).frame(minHeight: 40)
                    .foregroundStyle(on ? Palette.gold : Palette.foreground)
                    .background(on ? Palette.gold.opacity(0.15) : Palette.card, in: Capsule())
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
    }

    private func save() async {
        saving = true
        failed = false
        defer { saving = false }
        let cookingLabel = Self.cooking.first { $0.v == cooking }?.l ?? cooking
        let trimmedAvoid = avoid.trimmingCharacters(in: .whitespaces)
        var parts = ["\(meals) comidas al día", "Cocina: \(cookingLabel)"]
        if !trimmedAvoid.isEmpty { parts.append("Evitar: \(trimmedAvoid)") }
        if !likes.isEmpty { parts.append("Le gusta: \(likes.joined(separator: ", "))") }
        let extraAvoid = trimmedAvoid.split(separator: ",").map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }

        struct Row: Decodable { let availability: [String: AnyJSON]? }
        var availability = ((try? await Backend.client.from("onboarding").select("availability").eq("user_id", value: userId).single().execute().value as Row)?.availability) ?? [:]
        availability["meals_per_day"] = .integer(meals)
        availability["avoid_foods"] = .string(trimmedAvoid)
        availability["cooking"] = .string(cooking)

        struct Update: Encodable { let nutrition_preferences: String; let allergies: String; let availability: [String: AnyJSON] }
        do {
            try await Backend.client.from("onboarding")
                .update(Update(nutrition_preferences: parts.joined(separator: " · "),
                               allergies: (dislikes + extraAvoid).joined(separator: ", "),
                               availability: availability))
                .eq("user_id", value: userId)
                .execute()
            Haptics.success()
            onDone()
        } catch {
            failed = true
        }
    }
}
