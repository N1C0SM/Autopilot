import SwiftUI
import Supabase

/// Onboarding de comidas de Plus, como `NutritionSetup` de la web. El onboarding general no
/// pregunta por comidas (el plan Gratis no las incluye): se piden aquí, la primera vez que
/// alguien con Plus abre Nutrición. Guarda las mismas columnas que la web.
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
        VStack(alignment: .leading, spacing: 28) {
            VStack(spacing: 8) {
                Image(systemName: "sparkles").font(.system(size: 30)).foregroundStyle(Palette.gold)
                    .frame(width: 72, height: 72).background(Palette.card, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                Text("Incluido en Plus").font(.apSubhead).foregroundStyle(Palette.muted)
                (Text("Tus comidas, ") + Text("hechas para ti").foregroundColor(Palette.gold)).font(.apTitle1).multilineTextAlignment(.center)
                Text("Cuatro preguntas y Autopilot te prepara las comidas de cada día, ajustadas a tus macros.")
                    .font(.apSubhead).foregroundStyle(Palette.muted).multilineTextAlignment(.center)
            }
            .frame(maxWidth: .infinity)

            group("Comidas al día") {
                HStack(spacing: 8) {
                    ForEach([2, 3, 4, 5], id: \.self) { n in
                        Button { Haptics.selection(); meals = n } label: {
                            Text("\(n)").font(.apHeadline).frame(maxWidth: .infinity, minHeight: 48)
                                .foregroundStyle(meals == n ? Color.black : Color.white)
                                .background(meals == n ? Palette.gold : Palette.card, in: Capsule())
                        }
                        .buttonStyle(.plain)
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
                            }
                            .padding(.horizontal, 16).frame(minHeight: 56).contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityAddTraits(cooking == o.v ? .isSelected : [])
                    }
                }
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }

            group("¿Qué te gusta comer?") { chips(Self.likesOptions, selection: $likes) }
            group("¿Qué no comes?") { chips(Self.avoidOptions, selection: $dislikes) }
            group("¿Algo más que evitar? (opcional)") {
                TextField("Ej. avena, champiñones…", text: $avoid)
                    .padding(.horizontal, 18).frame(minHeight: 48)
                    .background(Palette.card, in: Capsule())
            }

            if failed {
                Text("No se pudo guardar. Revisa tu conexión e inténtalo otra vez.").font(.apFootnote).foregroundStyle(Palette.destructive)
            }
            Button { Task { await save() } } label: {
                HStack(spacing: 8) {
                    if saving { ProgressView().tint(.black) }
                    Text("Preparar mis comidas")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.pill)
            .disabled(saving)
        }
    }

    private func group<Content: View>(_ title: String, @ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased()).font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted).padding(.horizontal, 4)
            content()
        }
    }

    private func chips(_ options: [String], selection: Binding<[String]>) -> some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 104), spacing: 8)], alignment: .leading, spacing: 8) {
            ForEach(options, id: \.self) { o in
                let on = selection.wrappedValue.contains(o)
                Button {
                    Haptics.selection()
                    if on { selection.wrappedValue.removeAll { $0 == o } } else { selection.wrappedValue.append(o) }
                } label: {
                    Text(o).font(.apSubhead.weight(.medium)).lineLimit(1).minimumScaleFactor(0.8)
                        .frame(maxWidth: .infinity, minHeight: 40)
                        .foregroundStyle(on ? Color.black : Color.white)
                        .background(on ? Palette.gold : Palette.card, in: Capsule())
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
