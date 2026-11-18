using FluentValidation;

namespace TAKAHATA.Application.MaintenanceProcess.Commands
{
    public class OperateMachineMaintenanceProcessCommandValidator
        : AbstractValidator<OperateMachineMaintenanceProcessCommand>
    {
        public OperateMachineMaintenanceProcessCommandValidator()
        {
            RuleFor(command => command.Id).GreaterThan(0);
            RuleFor(command => command.Action).IsInEnum();
            RuleFor(command => command.PerformedBy)
                .NotEmpty()
                .MaximumLength(100)
                .Must(value => !string.IsNullOrWhiteSpace(value))
                .WithMessage("Vui lòng nhập người thực hiện.");
        }
    }
}
