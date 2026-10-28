import SwiftUI
import Supabase

/// Entrenadores, calcado de `TrainerManagement.tsx`: lista con usuarios asignados, «Promover usuario»
/// y ficha con pestañas Perfil público · Usuarios · Chat.
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
    @State private var rolesFailed = false

    private var trainerProfiles: [AdminData.Profile] {
        data.profiles.filter { trainers.contains($0.user_id) }.sorted { $0.display.localizedCaseInsensitiveCompare($1.display) == .orderedAscending }
    }

    private func plural(_ n: Int) -> String { "\(n) usuario\(n == 1 ? "" : "s") asignado\(n == 1 ? "" : "s")" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                if !data.loaded {
                    skeleton
                } else if data.failed && data.profiles.isEmpty {
                    AdminErrorCard(title: "No hemos podido cargar los entrenadores",
                                   message: "Revisa la conexión y vuelve a intentarlo.") {
                        Task { await reloadAll() }
                    }
                } else {
                    if data.failed { AdminKitRefreshWarning { Task { await reloadAll() } } }
                    if rolesFailed {
                        AdminKitRefreshWarning(message: "No hemos podido cargar los roles de entrenador.") {
                            Task { await reloadAll() }
                        }
                    }
                    Text("\(trainerProfiles.count) entrenador\(trainerProfiles.count == 1 ? "" : "es")")
                        .font(.apSubhead)
                        .foregroundStyle(Palette.muted)
                        .monospacedDigit()
                    if trainerProfiles.isEmpty {
                        if rolesFailed {
                            AdminErrorCard(title: "No hemos podido cargar los entrenadores",
                                           message: "Revisa la conexión y vuelve a intentarlo.") {
                                Task { await reloadAll() }
                            }
                        } else {
                            emptyState
                        }
                    } else {
                        ListGroupView(header: "Entrenadores (\(trainerProfiles.count))") {
                            ForEach(Array(trainerProfiles.enumerated()), id: \.element.id) { i, t in
                                NavigationLink {
                                    TrainerDetail(trainer: t, allUsers: data.profiles, staff: trainers.union(admins), assignments: $assignments) { await reloadRoles() }
                                        .navigationTitle(t.display)
                                } label: {
                                    trainerRow(t, first: i == 0)
                                }
                                .buttonStyle(.plain)
                                .accessibilityElement(children: .combine)
                                .accessibilityHint("Abre la ficha del entrenador")
                            }
                        }
                        promoteAction
                    }
                    if promoteOpen { promotePanel }
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await reloadAll() }
        .refreshable { await reloadAll() }
    }

    // MARK: Lista

    private func trainerRow(_ t: AdminData.Profile, first: Bool) -> some View {
        HStack(spacing: 12) {
            AvatarView(name: t.display, url: t.avatar_url, size: 40)
            VStack(alignment: .leading, spacing: 1) {
                Text(t.display).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
                Text(plural(assignments.filter { $0.trainer_id == t.user_id }.count))
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 8)
            Image(systemName: "chevron.right")
                .font(.inter(.footnote).weight(.semibold))
                .foregroundStyle(Palette.muted)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 64)
        .overlay(alignment: .top) {
            if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 68) }
        }
        .contentShape(Rectangle())
    }

    private var emptyState: some View {
        Card(padding: 12, radius: Radius.hero) {
            EmptyStateView(symbol: "person.2", title: "No hay entrenadores aún",
                           message: "Promueve a un usuario para que aparezca aquí.")
            Button {
                Haptics.tap()
                promoteOpen = true
            } label: {
                Text("Promover primer entrenador")
            }
            .buttonStyle(.pill)
            .frame(maxWidth: 320)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 8)
        }
    }

    private var promoteAction: some View {
        Button {
            Haptics.selection()
            promoteOpen.toggle()
        } label: {
            HStack(spacing: 12) {
                IconTile(symbol: "person.badge.plus", size: 32, tint: Palette.gold)
                VStack(alignment: .leading, spacing: 1) {
                    Text("Promover usuario").font(.apBody.weight(.semibold))
                    Text("Dale acceso al panel de entrenador.")
                        .font(.apFootnote)
                        .foregroundStyle(Palette.muted)
                        .lineLimit(2)
                }
                Spacer(minLength: 8)
                Image(systemName: promoteOpen ? "chevron.up" : "chevron.down")
                    .font(.inter(.footnote).weight(.semibold))
                    .foregroundStyle(Palette.muted)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
            .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Promover usuario a entrenador")
        .accessibilityHint(promoteOpen ? "Cierra el buscador de cuentas" : "Abre el buscador de cuentas")
    }

    // MARK: Promover

    private var promotePanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("PROMOVER A ENTRENADOR")
                        .font(.apFootnote.weight(.semibold))
                        .tracking(0.6)
                        .foregroundStyle(Palette.muted)
                        .accessibilityAddTraits(.isHeader)
                    Text("Busca la cuenta y toca para darle acceso.")
                        .font(.apFootnote)
                        .foregroundStyle(Palette.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Spacer(minLength: 8)
                Button {
                    Haptics.tap()
                    promoteOpen = false
                } label: {
                    Image(systemName: "xmark")
                        .font(.inter(size: 13, weight: .bold))
                        .foregroundStyle(Palette.foreground)
                        .frame(width: 32, height: 32)
                        .background(Palette.secondary, in: Circle())
                        .frame(width: 44, height: 44)
                        .contentShape(Circle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cerrar")
            }
            PillField(label: "Buscar por email…", text: $search, contentType: .email)
            candidates
        }
        .padding(16)
        .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
    }

    private var candidates: some View {
        let list = data.profiles.filter {
            !trainers.contains($0.user_id) && !admins.contains($0.user_id) &&
            (search.isEmpty || ($0.email ?? "").localizedCaseInsensitiveContains(search))
        }.prefix(30)
        return Group {
            if list.isEmpty {
                EmptyStateView(symbol: "magnifyingglass", title: "No hay cuentas disponibles",
                               message: search.isEmpty ? nil : "Prueba con otro email.")
            } else {
                VStack(spacing: 0) {
                    ForEach(Array(list.enumerated()), id: \.element.id) { i, u in
                        Button {
                            Haptics.tap()
                            Task { await promote(u.user_id) }
                        } label: {
                            HStack(spacing: 12) {
                                AvatarView(name: u.display, url: u.avatar_url, size: 36)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(u.display).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
                                    Text(u.email ?? "").font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1).truncationMode(.middle)
                                }
                                Spacer(minLength: 8)
                                Image(systemName: "person.badge.plus")
                                    .font(.inter(.body).weight(.semibold))
                                    .foregroundStyle(Palette.gold)
                            }
                            .padding(.horizontal, 16)
                            .frame(minHeight: 56)
                            .overlay(alignment: .top) {
                                if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .combine)
                        .accessibilityHint("Promueve esta cuenta a entrenador")
                    }
                }
                .background(Palette.background.opacity(0.35), in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
        }
    }

    private var skeleton: some View {
        AdminKitSkeletonPulse {
            VStack(alignment: .leading, spacing: 20) {
                AdminKitSkeletonBlock(height: 12, radius: 6, width: 120)
                AdminKitSkeletonBlock(height: 230, radius: Radius.card)
                AdminKitSkeletonBlock(height: 72, radius: Radius.card)
            }
        }
    }

    private func reloadAll() async {
        await data.load()
        await reloadRoles()
    }

    private func reloadRoles() async {
        do {
            let roles: [Role] = try await Backend.client.from("user_roles").select("user_id, role").in("role", values: ["admin", "trainer"]).execute().value
            trainers = Set(roles.filter { $0.role == "trainer" }.map(\.user_id))
            admins = Set(roles.filter { $0.role == "admin" }.map(\.user_id))
            rolesFailed = false
        } catch {
            rolesFailed = true
        }
        assignments = (try? await Backend.client.from("trainer_assignments").select("id, trainer_id, user_id").execute().value) ?? []
    }

    private func promote(_ id: String) async {
        do {
            try await Backend.client.from("user_roles").insert(["user_id": id, "role": "trainer"]).execute()
            Haptics.success()
            show("Usuario promovido a entrenador")
            promoteOpen = false
            await reloadRoles()
        } catch {
            Haptics.error()
            show("Error: no se pudo promover")
        }
    }

    private func show(_ t: String) {
        toast = t
        Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil }
    }
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
    @State private var profileLoaded = false
    @State private var search = ""
    @State private var saving = false
    @State private var confirmRemove = false
    @State private var toast: String?
    @Environment(\.dismiss) private var dismiss

    private var mine: [AdminTrainersView.Assignment] { assignments.filter { $0.trainer_id == trainer.user_id } }

    private func plural(_ n: Int) -> String { "\(n) usuario\(n == 1 ? "" : "s") asignado\(n == 1 ? "" : "s")" }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                header
                SegmentedPill(options: ["Perfil público", "Usuarios", "Chat"], selection: $tab)
                    .accessibilityHint("Cambia entre las pestañas de la ficha")
                if tab == 0 {
                    profileTab
                } else if tab == 1 {
                    usersTab
                } else {
                    ChatView(conversationUserId: trainer.user_id).frame(minHeight: 480)
                    Text("Conversación privada admin ↔ entrenador.")
                        .font(.apFootnote)
                        .foregroundStyle(Palette.muted)
                        .frame(maxWidth: .infinity)
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 4)
            .padding(.bottom, 28)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .scrollDismissesKeyboard(.interactively)
        .screenBackground()
        .overlay(alignment: .top) { ToastView(text: toast) }
        .task { await loadProfile() }
        .confirmationDialog("¿Quitar el rol de entrenador?", isPresented: $confirmRemove, titleVisibility: .visible) {
            Button("Quitar rol", role: .destructive) { Task { await removeRole() } }
            Button("Cancelar", role: .cancel) {}
        } message: {
            Text("Sus asignaciones y su perfil público se eliminarán.")
        }
    }

    // MARK: Cabecera

    private var header: some View {
        HStack(spacing: 16) {
            AvatarView(name: profile?.display_name.isEmpty == false ? (profile?.display_name ?? trainer.display) : trainer.display,
                       url: profile?.photo_url ?? trainer.avatar_url, size: 72)
            VStack(alignment: .leading, spacing: 2) {
                Text(profile?.display_name.isEmpty == false ? (profile?.display_name ?? trainer.display) : trainer.display)
                    .font(.apTitle2)
                    .lineLimit(2)
                    .minimumScaleFactor(0.8)
                Text(trainer.email ?? "")
                    .font(.apSubhead)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Text(plural(mine.count))
                    .font(.apFootnote)
                    .foregroundStyle(Palette.muted)
                    .lineLimit(1)
            }
            Spacer(minLength: 0)
        }
        .accessibilityElement(children: .combine)
    }

    // MARK: Perfil público

    @ViewBuilder private var profileTab: some View {
        if !profileLoaded {
            AdminKitSkeletonPulse {
                VStack(alignment: .leading, spacing: 12) {
                    AdminKitSkeletonBlock(height: 12, radius: 6, width: 120)
                    AdminKitSkeletonBlock(height: 52, radius: 14)
                    ForEach(0..<4, id: \.self) { _ in
                        AdminKitSkeletonBlock(height: 52, radius: 14)
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Palette.card, in: RoundedRectangle(cornerRadius: Radius.card, style: .continuous))
            }
        } else if profile != nil {
            form
        } else {
            AdminErrorCard(title: "No hemos podido cargar el perfil",
                           message: "Revisa la conexión y vuelve a intentarlo.") {
                profileLoaded = false
                Task { await loadProfile() }
            }
        }
    }

    private var form: some View {
        VStack(alignment: .leading, spacing: 20) {
            ListGroupView(header: "Visibilidad") {
                Toggle(isOn: Binding(get: { profile?.visible ?? false }, set: { profile?.visible = $0 })) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Visible en la landing").font(.apBody)
                        Text("Aparecerá en la sección «Entrenadores»")
                            .font(.apFootnote)
                            .foregroundStyle(Palette.muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .tint(Palette.gold)
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .frame(minHeight: 56)
            }

            ListGroupView(header: "Perfil público") {
                field("Nombre público", "Carlos Méndez", Binding(get: { profile?.display_name ?? "" }, set: { profile?.display_name = $0 }), first: true)
                field("Especialidad", "Hipertrofia · Calistenia", Binding(get: { profile?.specialty ?? "" }, set: { profile?.specialty = $0 }))
                field("Titular corto", "Entrenamiento de fuerza adaptado a tu nivel", Binding(get: { profile?.headline ?? "" }, set: { profile?.headline = $0 }))
                bioField
                field("Orden", "0", Binding(get: { String(profile?.sort_order ?? 0) }, set: { profile?.sort_order = Int($0) ?? 0 }))
            }

            Button {
                Haptics.tap()
                Task { await save() }
            } label: {
                if saving {
                    ProgressView().tint(.black)
                } else {
                    Text("Guardar perfil")
                }
            }
            .buttonStyle(.pill)
            .frame(maxWidth: 320)
            .disabled(saving)
            .accessibilityHint("Guarda los cambios del perfil público")

            ListGroupView(header: "Rol") {
                Button {
                    Haptics.warning()
                    confirmRemove = true
                } label: {
                    HStack(spacing: 8) {
                        Text("Quitar rol de entrenador").font(.apBody)
                        Spacer(minLength: 8)
                    }
                    .foregroundStyle(Palette.destructive)
                    .padding(.horizontal, 16)
                    .frame(minHeight: 50)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Elimina asignaciones y perfil público de este entrenador")
            }
            Text("Se eliminan sus asignaciones y su perfil público.")
                .font(.apFootnote)
                .foregroundStyle(Palette.muted)
                .padding(.horizontal, 16)
        }
    }

    private func field(_ label: String, _ placeholder: String, _ value: Binding<String>, first: Bool = false) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(label).font(.apFootnote).foregroundStyle(Palette.muted)
            TextField(placeholder, text: value)
                .textFieldStyle(.plain)
                .font(.apBody)
                .padding(.horizontal, 16)
                .frame(minHeight: 44)
                .background(Palette.secondary, in: Capsule())
                .accessibilityLabel(label)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .overlay(alignment: .top) {
            if !first { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16) }
        }
    }

    private var bioField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Bio").font(.apFootnote).foregroundStyle(Palette.muted)
            TextEditor(text: Binding(get: { profile?.bio ?? "" }, set: { profile?.bio = $0 }))
                .scrollContentBackground(.hidden)
                .font(.apBody)
                .frame(minHeight: 110)
                .padding(10)
                .background(Palette.secondary, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                .accessibilityLabel("Bio")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .overlay(alignment: .top) {
            Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 16)
        }
    }

    // MARK: Usuarios

    private var usersTab: some View {
        VStack(alignment: .leading, spacing: 20) {
            let assigned = mine.compactMap { a in allUsers.first { $0.user_id == a.user_id }.map { (a, $0) } }
            if assigned.isEmpty {
                Card(padding: 8, radius: Radius.hero) {
                    EmptyStateView(symbol: "person.2", title: "Aún no hay usuarios asignados",
                                   message: "Elige uno de la lista de abajo.")
                }
            } else {
                ListGroupView(header: "Usuarios asignados (\(assigned.count))") {
                    ForEach(Array(assigned.enumerated()), id: \.element.0.id) { i, pair in
                        HStack(spacing: 12) {
                            AvatarView(name: pair.1.display, url: pair.1.avatar_url, size: 36)
                            VStack(alignment: .leading, spacing: 1) {
                                Text(pair.1.display).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
                                Text(pair.1.email ?? "").font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1).truncationMode(.middle)
                            }
                            Spacer(minLength: 8)
                            Button {
                                Haptics.tap()
                                Task { await unassign(pair.0) }
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.inter(.footnote).weight(.semibold))
                                    .foregroundStyle(Palette.muted)
                                    .frame(width: 44, height: 44)
                                    .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel("Quitar \(pair.1.display) de este entrenador")
                            .accessibilityHint("Elimina la asignación")
                        }
                        .padding(.leading, 16)
                        .padding(.trailing, 4)
                        .frame(minHeight: 60)
                        .overlay(alignment: .top) {
                            if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) }
                        }
                    }
                }
            }
            ListGroupView(header: "Asignar usuario") {
                PillField(label: "Buscar por email…", text: $search, contentType: .email)
                    .padding(16)
                let assignable = allUsers.filter { u in
                    !staff.contains(u.user_id) && !mine.contains(where: { $0.user_id == u.user_id }) &&
                    (search.isEmpty || (u.email ?? "").localizedCaseInsensitiveContains(search))
                }.prefix(30)
                if assignable.isEmpty {
                    EmptyStateView(symbol: "magnifyingglass", title: "Sin usuarios disponibles",
                                   message: search.isEmpty ? nil : "Prueba con otro email.")
                } else {
                    ForEach(Array(assignable.enumerated()), id: \.element.id) { i, u in
                        Button {
                            Haptics.tap()
                            Task { await assign(u.user_id) }
                        } label: {
                            HStack(spacing: 12) {
                                AvatarView(name: u.display, url: u.avatar_url, size: 36)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(u.display).font(.apBody).lineLimit(1).minimumScaleFactor(0.85)
                                    Text(u.email ?? "").font(.apFootnote).foregroundStyle(Palette.muted).lineLimit(1).truncationMode(.middle)
                                }
                                Spacer(minLength: 8)
                                if assignments.contains(where: { $0.user_id == u.user_id }) {
                                    Text("Reasignar").font(.apFootnote).foregroundStyle(Palette.muted)
                                }
                                Image(systemName: "person.badge.plus")
                                    .font(.inter(.body).weight(.semibold))
                                    .foregroundStyle(Palette.gold)
                            }
                            .padding(.horizontal, 16)
                            .frame(minHeight: 56)
                            .overlay(alignment: .top) {
                                if i > 0 { Rectangle().fill(Palette.separator).frame(height: 0.5).padding(.leading, 64) }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityElement(children: .combine)
                        .accessibilityHint("Asigna este usuario al entrenador")
                    }
                }
            }
        }
    }

    // MARK: Datos

    private func loadProfile() async {
        do {
            let rows: [TrainerProfile] = try await Backend.client.from("trainer_profiles")
                .select("id, user_id, display_name, specialty, headline, bio, photo_url, visible, sort_order")
                .eq("user_id", value: trainer.user_id).limit(1).execute().value
            profile = rows.first ?? TrainerProfile(id: nil, user_id: trainer.user_id, display_name: "", specialty: "",
                                                   headline: "", bio: "", photo_url: nil, visible: false, sort_order: 0)
        } catch {
            profile = nil
        }
        profileLoaded = true
    }

    private func save() async {
        guard let p = profile else { return }
        saving = true
        defer { saving = false }
        do {
            let saved: TrainerProfile = try await Backend.client.from("trainer_profiles").upsert(p, onConflict: "user_id").select().single().execute().value
            profile = saved
            Haptics.success()
            show("Perfil guardado")
        } catch {
            Haptics.error()
            show("Error: no se pudo guardar")
        }
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
            Haptics.success()
            show("Usuario asignado")
        } catch {
            Haptics.error()
            show("Error: no se pudo asignar")
        }
    }

    private func unassign(_ a: AdminTrainersView.Assignment) async {
        do {
            try await Backend.client.from("trainer_assignments").delete().eq("id", value: a.id).execute()
            assignments.removeAll { $0.id == a.id }
            Haptics.success()
            show("Usuario desasignado")
        } catch {
            Haptics.error()
            show("Error: no se pudo desasignar")
        }
    }

    private func removeRole() async {
        _ = try? await Backend.client.from("trainer_assignments").delete().eq("trainer_id", value: trainer.user_id).execute()
        _ = try? await Backend.client.from("trainer_profiles").delete().eq("user_id", value: trainer.user_id).execute()
        do {
            try await Backend.client.from("user_roles").delete().eq("user_id", value: trainer.user_id).eq("role", value: "trainer").execute()
            await onRolesChange()
            dismiss()
        } catch {
            Haptics.error()
            show("Error: no se pudo quitar el rol")
        }
    }

    private func show(_ t: String) {
        toast = t
        Task { try? await Task.sleep(for: .seconds(2.5)); toast = nil }
    }
}
