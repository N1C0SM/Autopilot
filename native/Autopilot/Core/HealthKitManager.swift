import Foundation
#if canImport(HealthKit)
import HealthKit

/// Integración nativa con Apple Health (HealthKit) para la versión 1.0:
/// 1. Guarda los entrenamientos completados en Apple Salud (duración, energía activa estimada).
/// 2. Lee el peso corporal más reciente para actualizar métricas de progreso de forma transparente.
@MainActor
public final class HealthKitManager: ObservableObject {
    public static let shared = HealthKitManager()

    private let healthStore = HKHealthStore()
    @Published public private(set) var isAuthorized = false
    @Published public private(set) var latestWeightKg: Double?

    private init() {
        checkAvailability()
    }

    public var isHealthKitAvailable: Bool {
        HKHealthStore.isHealthDataAvailable()
    }

    private func checkAvailability() {
        guard isHealthKitAvailable else { return }
    }

    /// Solicita permisos de lectura y escritura requeridos por la versión 1.0 del Roadmap
    public func requestAuthorization() async -> Bool {
        guard isHealthKitAvailable else { return false }

        guard let bodyMass = HKQuantityType.quantityType(forIdentifier: .bodyMass),
              let activeEnergy = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) else {
            return false
        }

        let typesToShare: Set<HKSampleType> = [
            HKObjectType.workoutType(),
            activeEnergy
        ]

        let typesToRead: Set<HKObjectType> = [
            bodyMass,
            HKObjectType.workoutType()
        ]

        do {
            try await healthStore.requestAuthorization(toShare: typesToShare, read: typesToRead)
            self.isAuthorized = true
            await fetchLatestWeight()
            return true
        } catch {
            self.isAuthorized = false
            return false
        }
    }

    /// Guarda la sesión finalizada en Apple Salud (HKWorkout)
    public func saveWorkout(
        title: String,
        startedAt: Date,
        endedAt: Date,
        calories: Double? = nil
    ) async -> Bool {
        guard isHealthKitAvailable else { return false }

        let configuration = HKWorkoutConfiguration()
        configuration.activityType = .traditionalStrengthTraining
        configuration.locationType = .indoor

        let builder = HKWorkoutBuilder(healthStore: healthStore, configuration: configuration, device: .local())

        do {
            try await builder.beginCollection(at: startedAt)

            if let cal = calories, cal > 0, let energyType = HKQuantityType.quantityType(forIdentifier: .activeEnergyBurned) {
                let quantity = HKQuantity(unit: .kilocalorie(), doubleValue: cal)
                let sample = HKCumulativeQuantitySample(type: energyType, quantity: quantity, start: startedAt, end: endedAt)
                try await builder.addSamples([sample])
            }

            try await builder.endCollection(at: endedAt)
            _ = try await builder.finishWorkout()
            return true
        } catch {
            return false
        }
    }

    /// Obtiene el peso corporal más reciente registrado en Apple Salud
    public func fetchLatestWeight() async {
        guard isHealthKitAvailable, let bodyMassType = HKQuantityType.quantityType(forIdentifier: .bodyMass) else { return }

        let sortDescriptor = NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)
        let sampleQuery = HKSampleQuery(
            sampleType: bodyMassType,
            predicate: nil,
            limit: 1,
            sortDescriptors: [sortDescriptor]
        ) { [weak self] _, samples, _ in
            guard let sample = samples?.first as? HKQuantitySample else { return }
            let weightInKg = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
            Task { @MainActor in
                self?.latestWeightKg = weightInKg
            }
        }

        healthStore.execute(sampleQuery)
    }
}
#else
// Fallback para plataformas sin soporte HealthKit (macOS)
@MainActor
public final class HealthKitManager: ObservableObject {
    public static let shared = HealthKitManager()
    @Published public private(set) var isAuthorized = false
    @Published public private(set) var latestWeightKg: Double?

    public var isHealthKitAvailable: Bool { false }
    public func requestAuthorization() async -> Bool { false }
    public func saveWorkout(title: String, startedAt: Date, endedAt: Date, calories: Double? = nil) async -> Bool { false }
    public func fetchLatestWeight() async {}
}
#endif
