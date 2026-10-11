export function AccessDenied() {
  return (
    <div className="flex flex-col items-start gap-2 py-8">
      <h1 className="text-xl font-semibold">Erişim yetkiniz yok</h1>
      <p className="text-muted-foreground">
        Bu sayfayı görüntülemek için gerekli yetkiye sahip değilsiniz. Gerekirse
        yöneticinizden rolünüzü güncellemesini isteyin.
      </p>
    </div>
  );
}
