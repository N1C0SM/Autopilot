import SwiftUI
import Supabase

/// Entrenadores, calcado de `TrainerManagement.tsx`: lista con usuarios asignados, «Promover usuario»
/// y ficha con pestañas Perfil público · Usuarios (el chat queda en la web por ahora).
struct AdminTrainersView: View {
    struct Assignment: Codable, Identifiable { let id: String; let trainer_id: String; let user_id: String }
    struct Role: Decodable { let user_id: String; let role: String }

    @StateObject private var data = AdminData()
    @State private var trainers: Set<String> = []
    @State private var admins: Set<String> = []
    @State private var assignments: [Assignment] = []
    @State private var promoteOpen = false
    @State private var search = ""
    @State private var toast: String?

    private var trainerProfiles: [AdminData.Profile] { data.profiles.filter { trainers.contains($0.user_id) } }
    private func plural(_ n: Int) -> String { "\(n) usuario\(n == 1 ? "" : "s") asignado\(n == 1 ? "" : "s")" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 24) {
                Text("\(trainerProfiles.count) entrenador\(trainerProfiles.count == 1 ? "" : "es")").font(.apSubhead).foregroundStyle(Palette.muted)
                if trainerProfiles.isEmpty && data.loaded {
                    VStack(spacing: 10) {
                        EmptyStateView(symbol: "person.2", title: "No hay entrenadores aún", message: "Promueve a un usuario para que aparezca aquí.")
                        Button("Promover primer entrenador") { promoteOpen = true }.foregroundStyle(Palette.gold).buttonStyle(.plain)
                    }
                    .frame(maxWidth: .infinity)
                } else {
                    VStack(spacing: 0) {
                        ForEach(Array(trainerProfiles.enumerated()), id: \.element.id) { i, t in
                            NavigationLink {
                                TrainerDetail(trainer: t, allUsers: data.profiles, staff: trainers.union(admins), assignments: $assignments) { await reloadRoles() }
                                    .navigationTitle(t.display)
                            } label: {
                                row(initial: t.display, title: t.display, subtitle: plural(assignments.filter { $0.trainer_id == t.user_id }.count), first: i == 0, chevron: true)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    Button { promoteOpen.toggle() } label: {
                        Label("Promover usuario", systemImage: "person.badge.plus").font(.apBody).foregroundStyle(Palette.gold)
                            .padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                    }
                    .buttonStyle(.plain)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                }
                if promoteOpen {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("PROMOVER A ENTRENADOR").font(.apFootnote).foregroundStyle(Palette.muted)
                            Spacer()
                            Button { promoteOpen = false } label: { Image(systemName: "xmark") }.buttonStyle(.plain).frame(width: 44, height: 44).accessibilityLabel("Cerrar")
                        }
                        PillField(label: "Buscar por email…", text: $search, contentType: .email)
                        let list = data.profiles.filter { !trainers.contains($0.user_id) && !admins.contains($0.user_id) && (search.isEmpty || ($0.email ?? "").localizedCaseInsensitiveContains(search)) }.prefix(30)
                        if list.isEmpty { EmptyStateView(symbol: "magnifyingglass", title: "No hay usuarios disponibles") }
                        VStack(spacing: 0) {
                            ForEach(Array(list.enumerated()), id: \.element.id) { i, u in
                                Button { Task { await promote(u.user_id) } } label: {
                                    row(initial: u.email ?? "?", title: u.email ?? "", subtitle: nil, first: i == 0, trailing: "person.badge.plus")
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                    }
                }
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await data.load(); await reloadRoles() }
    }

    private func row(initial: String, title: String, subtitle: String?, first: Bool, chevron: Bool = false, trailing: String? = nil) -> some View {
        HStack(spacing: 12) {
            Text(String(initial.prefix(1)).uppercased()).font(.apFootnote.weight(.semibold)).foregroundStyle(Palette.muted)
                .frame(width: 36, height: 36).background(Palette.secondary, in: Circle())
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.apBody).lineLimit(1)
                if let subtitle { Text(subtitle).font(.apFootnote).foregroundStyle(Palette.muted) }
            }
            Spacer()
            if let trailing { Image(systemName: trailing).foregroundStyle(Palette.gold) }
            if chevron { Image(systemName: "chevron.right").font(.footnote.weight(.semibold)).foregroundStyle(Palette.muted) }
        }
        .padding(.horizontal, 16).frame(minHeight: 56)
        .overlay(alignment: .top) { if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) } }
        .contentShape(Rectangle())
    }

    private func reloadRoles() async {
        let roles: [Role] = (try? await Backend.client.from("user_roles").select("user_id, role").in("role", values: ["admin", "trainer"]).execute().value) ?? []
        trainers = Set(roles.filter { $0.role == "trainer" }.map(\.user_id))
        admins = Set(roles.filter { $0.role == "admin" }.map(\.user_id))
        assignments = (try? await Backend.client.from("trainer_assignments").select("id, trainer_id, user_id").execute().value) ?? []
    }

    private func promote(_ id: String) async {
        do {
            try await Backend.client.from("user_roles").insert(["user_id": id, "role": "trainer"]).execute()
            show("Usuario promovido a entrenador"); promoteOpen = false
            await reloadRoles()
        } catch { show("Error: no se pudo promover") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil } }
}

/// Ficha de entrenador: perfil público (visible, nombre, especialidad, titular, bio, orden) y usuarios asignados.
struct TrainerDetail: View {
    struct TrainerProfile: Codable {
        var id: String?; var user_id: String; var display_name: String; var specialty: String; var headline: String
        var bio: String; var photo_url: String?; var visible: Bool; var sort_order: Int
    }
    let trainer: AdminData.Profile
    let allUsers: [AdminData.Profile]
    let staff: Set<String>
    @Binding var assignments: [AdminTrainersView.Assignment]
    var onRolesChange: () async -> Void

    @State private var tab = 0
    @State private var profile: TrainerProfile?
    @State private var search = ""
    @State private var saving = false
    @State private var confirmRemove = false
    @State private var toast: String?
    @Environment(\.dismiss) private var dismiss

    private var mine: [AdminTrainersView.Assignment] { assignments.filter { $0.trainer_id == trainer.user_id } }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(trainer.email ?? "").font(.apSubhead).foregroundStyle(Palette.muted)
                    Text("\(mine.count) usuario\(mine.count == 1 ? "" : "s") asignado\(mine.count == 1 ? "" : "s")").font(.apFootnote).foregroundStyle(Palette.muted)
                }
                SegmentedPill(options: ["Perfil público", "Usuarios", "Chat"], selection: $tab)
                if tab == 0 { profileTab } else if tab == 1 { usersTab } else {
                    ChatView(conversationUserId: trainer.user_id).frame(minHeight: 480)
                    Text("Conversación privada admin ↔ entrenador.").font(.apFootnote).foregroundStyle(Palette.muted).frame(maxWidth: .infinity)
                }
            }
            .padding(20).frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await loadProfile() }
        .confirmationDialog("¿Quitar el rol de entrenador?", isPresented: $confirmRemove, titleVisibility: .visible) {
            Button("Quitar rol", role: .destructive) { Task { await removeRole() } }
            Button("Cancelar", role: .cancel) {}
        } message: { Text("Sus asignaciones y su perfil público se eliminarán.") }
    }

    @ViewBuilder private var profileTab: some View {
        if let p = profile {
            HStack(spacing: 16) {
                AvatarView(name: p.display_name.isEmpty ? trainer.display : p.display_name, url: p.photo_url, size: 80)
                if p.photo_url?.isEmpty == false {
                    Button("Quitar foto") { profile?.photo_url = "" }.font(.apSubhead).foregroundStyle(Palette.muted).buttonStyle(.plain)
                }
            }
            VStack(spacing: 0) {
                Toggle(isOn: Binding(get: { p.visible }, set: { profile?.visible = $0 })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Visible en la landing").font(.apBody)
                        Text("Aparecerá en la sección «Entrenadores»").font(.apFootnote).foregroundStyle(Palette.muted)
                    }
                }
                .tint(Palette.gold).padding(16)
                field("Nombre público", "Carlos Méndez", Binding(get: { p.display_name }, set: { profile?.display_name = $0 }))
                field("Especialidad", "Hipertrofia · Calistenia", Binding(get: { p.specialty }, set: { profile?.specialty = $0 }))
                field("Titular corto", "Entrenamiento de fuerza adaptado a tu nivel", Binding(get: { p.headline }, set: { profile?.headline = $0 }))
                VStack(alignment: .leading, spacing: 6) {
                    Text("Bio").font(.apFootnote).foregroundStyle(Palette.muted)
                    TextEditor(text: Binding(get: { p.bio }, set: { profile?.bio = $0 })).scrollContentBackground(.hidden).frame(minHeight: 100)
                }
                .padding(16).overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
                field("Orden", "0", Binding(get: { String(p.sort_order) }, set: { profile?.sort_order = Int($0) ?? 0 }))
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            Button { Task { await save() } } label: { if saving { ProgressView().tint(.black) } else { Text("Guardar perfil") } }
                .buttonStyle(.pill).frame(maxWidth: 320).disabled(saving)
            VStack(alignment: .leading, spacing: 8) {
                Button("Quitar rol de entrenador") { Haptics.warning(); confirmRemove = true }
                    .font(.apBody).foregroundStyle(Palette.destructive).buttonStyle(.plain)
                    .padding(.horizontal, 16).frame(maxWidth: .infinity, minHeight: 50, alignment: .leading)
                    .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
                Text("Se eliminan sus asignaciones y su perfil público.").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            }
        } else {
            ProgressView().frame(maxWidth: .infinity).padding(.top, 40)
        }
    }

    private var usersTab: some View {
        VStack(alignment: .leading, spacing: 20) {
            let assigned = mine.compactMap { a in allUsers.first { $0.user_id == a.user_id }.map { (a, $0) } }
            if assigned.isEmpty {
                EmptyStateView(symbol: "person.2", title: "Aún no hay usuarios asignados", message: "Elige uno de la lista de abajo.")
            } else {
                ListGroupView(header: "Usuarios asignados (\(assigned.count))") {
                    ForEach(Array(assigned.enumerated()), id: \.element.0.id) { i, pair in
                        HStack {
                            Text(pair.1.email ?? "").font(.apBody).lineLimit(1)
                            Spacer()
                            Button { Task { await unassign(pair.0) } } label: { Image(systemName: "xmark") }
                                .buttonStyle(.plain).frame(width: 44, height: 44).accessibilityLabel("Quitar usuario")
                        }
                        .padding(.horizontal, 16).frame(minHeight: 50)
                        .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
                    }
                }
            }
            Text("ASIGNAR USUARIO").font(.apFootnote).foregroundStyle(Palette.muted).padding(.horizontal, 16)
            PillField(label: "Buscar por email…", text: $search, contentType: .email)
            let assignable = allUsers.filter { u in !staff.contains(u.user_id) && !mine.contains(where: { $0.user_id == u.user_id }) && (search.isEmpty || (u.email ?? "").localizedCaseInsensitiveContains(search)) }.prefix(30)
            VStack(spacing: 0) {
                ForEach(Array(assignable.enumerated()), id: \.element.id) { i, u in
                    Button { Task { await assign(u.user_id) } } label: {
                        HStack {
                            Text(u.email ?? "").font(.apBody).lineLimit(1)
                            Spacer()
                            if assignments.contains(where: { $0.user_id == u.user_id }) { Text("Reasignar").font(.caption) }
                            Image(systemName: "person.badge.plus").foregroundStyle(Palette.gold)
                        }
                        .padding(.horizontal, 16).frame(minHeight: 50)
                        .overlay(alignment: .top) { if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) } }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
    }

    private func field(_ label: String, _ placeholder: String, _ value: Binding<String>) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.apBody).frame(width: 130, alignment: .leading)
            TextField(placeholder, text: value).textFieldStyle(.plain)
        }
        .padding(.horizontal, 16).frame(minHeight: 50)
        .overlay(alignment: .top) { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
    }

    private func loadProfile() async {
        let rows: [TrainerProfile] = (try? await Backend.client.from("trainer_profiles")
            .select("id, user_id, display_name, specialty, headline, bio, photo_url, visible, sort_order")
            .eq("user_id", value: trainer.user_id).limit(1).execute().value) ?? []
        profile = rows.first ?? TrainerProfile(id: nil, user_id: trainer.user_id, display_name: "", specialty: "", headline: "", bio: "", photo_url: nil, visible: false, sort_order: 0)
    }

    private func save() async {
        guard let p = profile else { return }
        saving = true; defer { saving = false }
        do {
            let saved: TrainerProfile = try await Backend.client.from("trainer_profiles").upsert(p, onConflict: "user_id").select().single().execute().value
            profile = saved; Haptics.success(); show("Perfil guardado")
        } catch { Haptics.error(); show("Error: no se pudo guardar") }
    }

    private func assign(_ userId: String) async {
        do {
            if assignments.contains(where: { $0.user_id == userId }) {
                try await Backend.client.from("trainer_assignments").delete().eq("user_id", value: userId).execute()
            }
            let row: AdminTrainersView.Assignment = try await Backend.client.from("trainer_assignments")
                .insert(["trainer_id": trainer.user_id, "user_id": userId]).select("id, trainer_id, user_id").single().execute().value
            assignments.removeAll { $0.user_id == userId }
            assignments.append(row)
            show("Usuario asignado")
        } catch { show("Error: no se pudo asignar") }
    }

    private func unassign(_ a: AdminTrainersView.Assignment) async {
        do {
            try await Backend.client.from("trainer_assignments").delete().eq("id", value: a.id).execute()
            assignments.removeAll { $0.id == a.id }
            show("Usuario desasignado")
        } catch { show("Error: no se pudo desasignar") }
    }

    private func removeRole() async {
        _ = try? await Backend.client.from("trainer_assignments").delete().eq("trainer_id", value: trainer.user_id).execute()
        _ = try? await Backend.client.from("trainer_profiles").delete().eq("user_id", value: trainer.user_id).execute()
        do {
            try await Backend.client.from("user_roles").delete().eq("user_id", value: trainer.user_id).eq("role", value: "trainer").execute()
            await onRolesChange()
            dismiss()
        } catch { show("Error: no se pudo quitar el rol") }
    }

    private func show(_ t: String) { toast = t; Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil } }
}
