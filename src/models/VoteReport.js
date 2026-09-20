const mongoose = require('mongoose');

const voteReportSchema = new mongoose.Schema(
  {
    reporterName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['realtime', 'total'],
      required: true,
      index: true,
    },
    gender: {
      type: String,
      enum: ['female', 'male'],
      required: function requiredGender() {
        return this.type === 'realtime';
      },
    },
    women: {
      type: Number,
      min: 0,
      required: function requiredWomen() {
        return this.type === 'total';
      },
    },
    men: {
      type: Number,
      min: 0,
      required: function requiredMen() {
        return this.type === 'total';
      },
    },
    total: {
      type: Number,
      min: 0,
      required: function requiredTotal() {
        return this.type === 'total';
      },
    },
    clientId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: true },
  }
);

voteReportSchema.pre('validate', function validateTotal(next) {
  if (this.type === 'total') {
    const women = Number(this.women);
    const men = Number(this.men);
    const total = Number(this.total);
    if (women + men !== total) {
      this.invalidate('total', 'La suma de mujeres y hombres debe ser igual al total');
    }
  }
  next();
});

const VoteReport = mongoose.model('VoteReport', voteReportSchema);

module.exports = VoteReport;
