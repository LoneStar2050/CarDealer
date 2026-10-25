import { NotFoundError } from '../errors/httpErrors.js';
import type { VehicleRepository } from '../vehicles/vehicleRepository.js';
import type { RatingSummary, Review, ReviewInput } from './review.js';
import type { ReviewRepository } from './reviewRepository.js';

export interface VehicleReviews {
  reviews: Review[];
  summary: RatingSummary;
}

/** Business rules for vehicle reviews. The author always comes from the verified token. */
export class ReviewService {
  constructor(
    private readonly reviews: ReviewRepository,
    private readonly vehicles: VehicleRepository,
  ) {}

  async list(vehicleId: string, viewerId: string): Promise<VehicleReviews> {
    if (!(await this.vehicles.exists(vehicleId))) throw new NotFoundError('Vehicle not found');
    const [reviews, summary] = await Promise.all([
      this.reviews.listForVehicle(vehicleId, viewerId),
      this.reviews.summaryForVehicle(vehicleId),
    ]);
    return { reviews, summary };
  }

  /** Adds the user's review and returns it with the vehicle's updated summary. */
  async create(vehicleId: string, userId: string, input: ReviewInput): Promise<{ review: Review; summary: RatingSummary }> {
    const review = await this.reviews.create(vehicleId, userId, input);
    return { review, summary: await this.reviews.summaryForVehicle(vehicleId) };
  }
}
