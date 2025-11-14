"""
Grading Service - Auto-grade exams by comparing student answers with correct answers
"""
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)


class GradingService:
    """Service to grade student exam submissions"""
    
    def grade_exam(self, student_answers: List[Dict], questions: List[Dict]) -> Tuple[int, int, Dict]:
        """
        Grade an exam by comparing student answers with correct answers
        
        Args:
            student_answers: List of {question_number, answer} dicts
            questions: List of {question_number, correct_answer, points} dicts
        
        Returns:
            Tuple of (total_score, max_score, detailed_results)
        """
        total_score = 0
        max_score = 0
        results = {
            'correct_count': 0,
            'incorrect_count': 0,
            'unanswered_count': 0,
            'question_results': []
        }
        
        # Create lookup dictionaries
        answer_map = {ans['question_number']: ans['answer'] for ans in student_answers}
        question_map = {q['question_number']: q for q in questions}
        
        # Grade each question
        for question_num, question in question_map.items():
            correct_answer = question.get('correct_answer')
            points = question.get('points', 1)
            max_score += points
            
            student_answer = answer_map.get(question_num)
            
            # Determine if answer is correct
            is_correct = False
            status = 'unanswered'
            
            if student_answer:
                if student_answer.upper() == correct_answer.upper():
                    is_correct = True
                    total_score += points
                    status = 'correct'
                    results['correct_count'] += 1
                else:
                    status = 'incorrect'
                    results['incorrect_count'] += 1
            else:
                results['unanswered_count'] += 1
            
            # Store detailed result for this question
            results['question_results'].append({
                'question_number': question_num,
                'student_answer': student_answer,
                'correct_answer': correct_answer,
                'points': points,
                'earned_points': points if is_correct else 0,
                'is_correct': is_correct,
                'status': status
            })
        
        logger.info(f"✅ Grading complete: {total_score}/{max_score} points "
                   f"({results['correct_count']} correct, {results['incorrect_count']} incorrect, "
                   f"{results['unanswered_count']} unanswered)")
        
        return total_score, max_score, results
    
    def calculate_percentage(self, total_score: int, max_score: int) -> float:
        """Calculate percentage score"""
        if max_score == 0:
            return 0.0
        return round((total_score / max_score) * 100, 2)
    
    def get_grade_letter(self, percentage: float) -> str:
        """Convert percentage to letter grade"""
        if percentage >= 90:
            return 'A+'
        elif percentage >= 85:
            return 'A'
        elif percentage >= 80:
            return 'A-'
        elif percentage >= 75:
            return 'B+'
        elif percentage >= 70:
            return 'B'
        elif percentage >= 65:
            return 'B-'
        elif percentage >= 60:
            return 'C+'
        elif percentage >= 55:
            return 'C'
        elif percentage >= 50:
            return 'C-'
        elif percentage >= 40:
            return 'D'
        else:
            return 'F'


# Global instance
grading_service = GradingService()
