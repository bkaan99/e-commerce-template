/**
 * Süreç içi, kısa ömürlü (TTL) önbellek. Müşteriye göre değişmeyen ve nadiren
 * güncellenen okuma verileri (menü, kategori ağacı, banner) için kullanılır.
 *
 * - Aynı anahtar için eşzamanlı yüklemeler tek sorguya birleşir.
 * - Hatalar önbelleğe alınmaz.
 * - Çok örnekli (birden fazla sunucu) kurulumlarda diğer örnekler en geç TTL
 *   sonunda yeni veriyi görür; bu yüzden TTL kısa tutulmalıdır.
 */
export class TtlCache<K, V> {
  private readonly entries = new Map<
    K,
    { value: V; expiresAt: number } | { pending: Promise<V> }
  >();

  constructor(
    private readonly loader: (key: K) => Promise<V>,
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: K): Promise<V> {
    const entry = this.entries.get(key);

    if (entry && "pending" in entry) return entry.pending;
    if (entry && entry.expiresAt > this.now()) return entry.value;

    const pending = this.loader(key).then(
      (value) => {
        // Yükleme sırasında invalidate edildiyse sonuç saklanmaz.
        if (this.entries.get(key) === placeholder) {
          this.entries.set(key, {
            value,
            expiresAt: this.now() + this.ttlMs,
          });
        }
        return value;
      },
      (error: unknown) => {
        if (this.entries.get(key) === placeholder) this.entries.delete(key);
        throw error;
      },
    );

    const placeholder = { pending };
    this.entries.set(key, placeholder);
    return pending;
  }

  invalidate(): void {
    this.entries.clear();
  }
}
