export function ProductPageSkeleton() {
  return <main className="container section loading-page" aria-busy="true" aria-label="Loading product"><div className="skeleton skeleton-back-link" /><div className="detail loading-detail"><div className="skeleton detail-image" /><div className="loading-copy"><div className="skeleton skeleton-line short" /><div className="skeleton skeleton-title" /><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line medium" /><div className="skeleton skeleton-button" /></div></div></main>;
}

export function CollectionPageSkeleton() {
  return <main className="container section loading-page" aria-busy="true" aria-label="Loading collection"><div className="skeleton skeleton-line short" /><div className="skeleton skeleton-title collection-title" /><div className="skeleton skeleton-line medium" /><div className="product-grid loading-grid">{Array.from({ length: 4 }, (_, index) => <div className="product-card" key={index}><div className="skeleton product-image" /><div className="product-info"><div className="skeleton skeleton-line" /><div className="skeleton skeleton-line short" /></div></div>)}</div></main>;
}

export function CartPageSkeleton({ checkout = false }: { checkout?: boolean }) {
  return <main className="container section loading-page" aria-busy="true" aria-label={checkout ? "Preparing checkout" : "Loading cart"}><div className="skeleton skeleton-line short" /><div className="skeleton skeleton-title" /><div className={checkout ? "checkout-layout" : "cart-layout"}><section className={checkout ? "checkout-form" : "cart-items"}>{Array.from({ length: checkout ? 3 : 2 }, (_, index) => <div className="skeleton loading-card" key={index} />)}</section><aside className="skeleton summary-card loading-summary" /></div></main>;
}
